// (function() {
var Preferences = {
  shortestTimeSlotMinutes : 10,
  startHour : 9, // 9 am
  endHour : 17, // 5 pm
  workDays : [ 1, 2, 3, 4, 5 ]
};

var FreeTime = {
  authResult : {},
  calendars : null,
  events : [],
  times : []
};

// Your Client ID can be retrieved from your project in the Google
// Developer Console, https://console.developers.google.com
var CLIENT_ID = '899135431242-0ac4f9dv2u5l8ml34pafcl75819ib71b.apps.googleusercontent.com';

var SCOPES = [ "https://www.googleapis.com/auth/calendar.readonly" ];

var app = angular.module('freetime', []);

var init = function() {
  console.log("Google API's initialized");
  window.initGapi();
}

app.controller("FreeTimeController", function($scope, $window, gapiService) {
  console.log("Controller initialization...");
  this.events = [];
  this.busyBlocks = [];
  this.availableBlocks = [];
  this.preferences = Preferences;
  this.loadStatus = "Waiting";
  this.authorized = false;
  var controller = this;

  this.authenticate = function() {
    authorize(false, function(authResult) {
      console.log(authResult);
      controller.authorized = authResult && !authResult.error;
      controller.loadEvents();
    });
  };

  this.loadEvents = function() {
    console.log("Loading events ****************");
    console.log(controller);
    gapi.client.load('calendar', 'v3', function() {
      var request = gapi.client.calendar.events.list({
        'calendarId' : 'primary',
        'timeMin' : (new Date()).toISOString(),
        'showDeleted' : false,
        'singleEvents' : true,
        'maxResults' : 10,
        'orderBy' : 'startTime'
      });

      controller.loadStatus = "Requesting";
      request.execute(function(resp) {
        console.log(">> Response received.");
        var events = resp.items;
        controller.events = events;
        var blocks = listBusyBlocks(events);
        controller.busyBlocks = blocks;
        var available = listAvailable(blocks, Preferences.startHour,
            Preferences.endHour, new Date(),
            Preferences.shortestTimeSlotMinutes);
        controller.availableBlocks = available;
        controller.loadStatus = "Loaded";
        controller.authorized = true;
        $scope.$apply();
      });
    });
  }

  var postInitiation = function() {
    console.log("Post initiation started.");
    authorize(true, function(resultHandler) {
      if (resultHandler) {
        console.log("Valid results from gapi");
        controller.loadEvents();
      }
    });
  };
  logVerbose(this);
  $window.initGapi = function() {
    gapiService.initGapi(postInitiation);
  }
  console.log("... controller initialization complete");
});

var authorize = function(immediate, resultHandler) {
  gapi.auth.authorize({
    client_id : CLIENT_ID,
    scope : SCOPES,
    immediate : immediate
  }, resultHandler);
}

app.service('gapiService', function() {
  this.initGapi = function(postInitiation) {
    authorize(true, function(result) {
      console.log(result);
      if (result && !result.error) {
        postInitiation();
      }
    });
  }
});

function logVerbose(message) {
  // console.log(message);
}

function logInfo() {

}

function dateMin(a, b) {
  if (!a) {
    return b;
  }
  if (a < b) {
    return a;
  } else {
    return b;
  }
}

function toDuration(start, end) {
  var minutes = Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
  var hours = null;
  if (minutes >= 60) {
    hours = Math.floor(minutes / 60);
    minutes = minutes % 60
  }
  return (hours ? hours + ' hour(s) ' : '')
      + ((minutes != 0) ? minutes + ' minutes' : '').trim()

}

function listAvailable(busyBlocks, startHour, endHour, startAfter,
    minWindowMinutes) {
  var now = new Date();
  var startWindow = new Date();
  var endWindow = new Date();
  endWindow.setMinutes(0);
  endWindow.setSeconds(0);
  endWindow.setHours(endHour);
  startWindow.setHours(startHour);
  startWindow.setMinutes(0);
  startWindow.setSeconds(0);
  if (startWindow < now) {
    startWindow = now;
  }
  var availableBlock = [];
  for (i = 0; i < busyBlocks.length; i++) {
    var start = busyBlocks[i].start;
    var end = busyBlocks[i].end;
    //
    logVerbose({
      busyStart : start,
      busyEnd : end,
      windowStart : startWindow,
      windowEnd : endWindow
    });
    if (endWindow < startWindow) {
      endWindow.setDate(endWindow.getDate() + 1);
      startWindow.setHours(startHour);
      startWindow.setDate(endWindow.getDate());
    }
    // / FIX ME IF DAY CHANGES
    if (startWindow < start) {
      var period = {
        start : new Date(startWindow),
        end : dateMin(endWindow, start),
        duration : Math
            .floor((dateMin(endWindow, start).getTime() - startWindow.getTime()) / 1000 / 60)
      };
      if (period.start.getTime() + (minWindowMinutes * 1000 * 60) < period.end) {
        availableBlock.push(period);
      }
      logVerbose(availableBlock);
    }
    startWindow = new Date(end);
  }
  return availableBlock;
}

function listBusyBlocks(events) {
  var blocks = [];
  if (!events) {
    return blocks;
  }
  for (i = 0; i < events.length; i++) {
    var event = events[i];
    if (!event.start.dateTime || !event.end.dateTime) {
      continue;
    }
    var s = new Date(event.start.dateTime);
    var e = new Date(event.end.dateTime);
    var found = false;
    for (j = 0; j < blocks.length; j++) {
      if (s < blocks[j].start) {
        if (e > blocks[j].end) {
          blocks[j] = {
            start : s,
            end : e
          };
          found = true;
          break;
        } else if (e < blocks[j].end && e > blocks[j].start) {
          blocks[j] = {
            start : s,
            end : blocks[j].end
          };
          found = true;
          break;
        }
      } else if (s > blocks[j].start && s < blocks[j].end && e > blocks[j].end) {
        blocks[j] = {
          start : blocks[j].start,
          end : e
        };
        found = true;
        break;
      }
    }
    if (!found) {
      blocks.push({
        start : s,
        end : e
      });
    }
  }
  blocks.sort();
  return blocks;
}

function getTimezoneName() {
  var timezone = jstz.determine()
  return timezone.name();
}
// })();
