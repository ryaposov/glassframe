function record (logCallback) {		
  // Indicates whether or not jsReplay is playing back user events. When set to true, jsReplay will not start another playback nor record user events.
	var playbackInProgress = false;
	
	// Indicates whether or not jsReplay is recording user events. When set to true, jsReplay will not start another recording nor start a playback.
  var recordInProgress = false;
  
  var userEventLog = [];
  var ctrlKeyDown = false;
  
  // After recording is starting, startTimeDelay is set to the Unix time difference when the page was loaded and when recording started.
  // We use this value to adjust the timestamp stored on recorded events -- we don't want the dead time that occurs from when the page is loaded
  // until the recording is started to be reflected in our playback script.
  var startTimeDelay = new Date().getTime();
  
  /*	Function: _getSelectionText
      This function will retrieve the value of the text currently selected by the user.
    
    Returns: String
  */
  var _getSelectionText = function() {
    var text = "";
    var activeEl = document.activeElement;
    var activeElTagName = activeEl ? activeEl.tagName.toLowerCase() : null;
    if (
      (activeElTagName == "textarea") || (activeElTagName == "input" &&
      /^(?:text|search|password|tel|url)$/i.test(activeEl.type)) &&
      (typeof activeEl.selectionStart == "number")
    ) {
      text = activeEl.value.slice(activeEl.selectionStart, activeEl.selectionEnd);
    } else if (window.getSelection) {
      text = window.getSelection().toString();
    }
    return text;
  };
  
  /*	Function: logEvent
      This function will parse the 
  
  */
  var logEvent = function(event) {
    
    // Only record the event if recording is in progress
    if (recordInProgress == true) {
    
      var userEvent = {"selector":getSelector(event.target)};
      
      if (event.type === "scroll") {
        userEvent.type = "scroll";
        userEvent.scrollTop = $(event.target).scrollTop();
        userEvent.scrollLeft = $(event.target).scrollLeft();
        userEvent.timeStamp = event.timeStamp;
      } else {
        for (var prop in event) {
          // We can only record plain such as string, numbers and booleans in JSON. Objects will require special processing.
          if (["number","string","boolean"].indexOf(typeof event[prop]) > -1 
              // Exclude certain event event attributes in order to keep the JSON log as small as possible.
              // These attributes are not needed to re-create the event during playback.
              && ["AT_TARGET","BUBBLING_PHASE","CAPTURING_PHASE","NONE","DOM_KEY_LOCATION_STANDARD","DOM_KEY_LOCATION_LEFT","DOM_KEY_LOCATION_RIGHT","DOM_KEY_LOCATION_NUMPAD"].indexOf(prop) == -1) {
            userEvent[prop] = event[prop];
          } else if (["touches","changedTouches"].indexOf(prop) > -1) {
            
            userEvent[prop] = [];
            
            for (var i = 0; i < event[prop].length; i++) {
              var touch = event[prop][i];
              userEvent[prop].push({
                "clientX":touch.clientX
                ,"clientY":touch.clientY
                ,"force":touch.force
                ,"identifier":touch.identifier
                ,"pageX":touch.pageX
                ,"pageY":touch.pageY
                ,"radiusX":touch.radiusX
                ,"radiusY":touch.radiusY
                ,"rotationAngle":touch.rotationAngle
                ,"screenX":touch.screenX
                ,"screenY":touch.screenY
                ,"selector":getSelector(touch.target)
              });

            }

          }
        }
      }
      
      // Subtract the start time delay from the timestamp so we don't include the dead time (i.e., time between
      // page load and recording started) in our playback JSON log.
      userEvent.timeStamp = userEvent.timeStamp - startTimeDelay;
      
      if (userEvent.selector !== null) {
        if (playbackInProgress == false) {
          userEventLog.push(userEvent);
          logCallback(userEvent)
          console.log("Logged "+userEvent.type+" event.");
        }
      } else {
        console.warn("Null selector");
      }
    }
  };

  var getSelector = function domElementPath(element) {
    var parentElements = function parentElements(element) {
      var parents = [];
    
      while (element) {
        var tagName = element.nodeName.toLowerCase();
        var cssId = element.id ? "#".concat(element.id) : '';
        var cssClass = element.className ? ".".concat(element.className.replace(/\s+/g, '.')) : '';
        parents.unshift({
          element: element,
          selector: tagName + cssId + cssClass
        });
        element = element.parentNode !== document ? element.parentNode : false;
      }
    
      return parents;
    };
    
    var nthElement = function nthElement(element) {
      var c = element;
      var nth = 0;
    
      while (c.previousElementSibling !== null) {
        if (c.nodeName === element.nodeName) {
          nth++;
        }
    
        c = c.previousElementSibling;
      }
    
      return nth;
    };
    
    var nthSelectorNeeded = function nthSelectorNeeded(selector, path) {
      var querySelector = path === '' ? selector : "".concat(path, " > ").concat(selector);
      return document.querySelectorAll(querySelector).length > 1;
    };
    
    var buildPathString = function buildPathString(parents) {
      var pathArr = [];
      parents.forEach(function (parent) {
        if (nthSelectorNeeded(parent.selector, pathArr.join(' > '))) {
          parent.selector += ":nth-of-type(".concat(nthElement(parent.element) + 1, ")");
        }
    
        pathArr.push(parent.selector);
      });
      return pathArr.join(' > ');
    };

    if (element === document || element === document.documentElement) return 'document';
    
    if (!(element instanceof HTMLElement)) {
      throw new Error('element must be of type `HTMLElement`.');
    }
  
    return buildPathString(parentElements(element));
  };
  
  /*	Function: getSelector
      This function starts at the DOM element specified by 'el' and traverses upward through the DOM tree building out a unique 
      CSS selector for the DOM element 'el'.
      
    Parameters:
      el - DOM element, the element that we want to determine CSS selector
      names - Array of strings, records the CSS selectors for the target element and parent elements as we progress up the DOM tree.
    
    Returns:
      String, a unique CSS selector for the target element (el).
  */
  // var getSelector = function(el, names) {
  //   if (el === document || el === document.documentElement) return "document";
  //   if (el === document.body) return "body";
  //   if (typeof names === "undefined") var names = [];
  //   if (el.id) {
  //     names.unshift('#'+el.id);
  //     return names.join(" > ");
  //   } else if (el.className) {
  //     var arrNode = [].slice.call(el.parentNode.getElementsByClassName(el.className));
  //     var classSelector = el.className.split(" ").join(".");
  //     if (arrNode.length == 1) {
  //       names.unshift(el.tagName.toLowerCase()+"."+classSelector);
  //     } else {
  //       for (var c=1,e=el;e.previousElementSibling;e=e.previousElementSibling,c++); 
  //       names.unshift(el.tagName.toLowerCase()+":nth-child("+c+")");
  //     }
  //   } else {
  //     for (var c=1,e=el;e.previousElementSibling;e=e.previousElementSibling,c++); 
  //     names.unshift(el.tagName.toLowerCase()+":nth-child("+c+")");
  //   }
    
  //   if (el.parentNode !== document.body) {
  //     getSelector(el.parentNode, names) 
  //   }
  //   return names.join(" > ");
  // };
  
  document.addEventListener('click',function(event) { logEvent(event); },true);
  document.addEventListener('mousedown',function(event) { logEvent(event); },true);
  document.addEventListener('mouseup',function(event) { 
    
    logEvent(event);
    
    // if the user has selected text, then we want to record an extra 'contains' event. on playback, this is used
    // to verify that the selected text is contained within the target element
    var selectedText = _getSelectionText();
    if (selectedText.length > 1) {
      logEvent({"target":document.activeElement,"type":"contains","text":selectedText,"timeStamp":event.timeStamp});
    }
  },true);
  document.addEventListener('input',function(event) { 
    logEvent($.extend(true,event,{"value":$(event.target).val()})); 
  },true);
  document.addEventListener('focus',function(event) { logEvent(event); },true);
  document.addEventListener('focusin',function(event) { logEvent(event); },true);
  document.addEventListener('focusout',function(event) { logEvent(event); },true);
  document.addEventListener('blur',function(event) { logEvent(event);},true);
  document.addEventListener('keypress',function(event) { logEvent(event); },true);
  document.addEventListener('keydown',function(event) { logEvent(event); },true);
  document.addEventListener('keyup',function(event) { logEvent(event); },true);
  document.addEventListener('touchstart',function(event) {  logEvent(event); },true);
  document.addEventListener('touchend',function(event) { logEvent(event); },true);
  document.addEventListener('touchmove',function(event) { logEvent(event); },true);
  document.addEventListener('touchcancel',function(event) { logEvent(event); },true);
  document.addEventListener('scroll',function(event) { logEvent(event); }, true);
  
  return {
  
    /*	Method: start
        When this method is invoked, jsReplay will begin to record all user events that occur on the web page.
    */
    "start": function() {
      if (playbackInProgress == false) {
        
        console.log("Start recording.");
        
        // Record the time that occurred from the page being loaded to the recording started. We will
        // subtract this value from the timestamp on the events in order to eliminate the dead time from our playback JSON log.
        startTimeDelay = Math.abs(startTimeDelay - new Date().getTime());
        recordInProgress = true;
        
      } else {
        throw new Error("Cannot start recording -- test playback is in progress.");
      }
    },
    
    /*	Method: stop
        When this method is invoked, jsReplay will stop recording user events and print playback JSON script to the console.
    */
    "stop": function() {
      
      console.log("Stop recording.");
      
      recordInProgress = false;
    
      var playbackScript = {
        "window":{"width":window.innerWidth,"height":window.innerHeight}
        ,"event_log":userEventLog
      };
      
      console.log(JSON.stringify(playbackScript));
    }
  };	
}