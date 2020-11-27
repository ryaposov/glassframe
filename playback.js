function playback (userEvent) {
			
  var selectorHash = {};
  
  /* 	Function: verifyContains 
      Verifies whether the element specified by the userEvent.selector contains the text stored in userEvent.text
    
    Parameters:
      userEvent - Object, a single DOM event from the JSON playback file. 
    
    Returns:
      Boolean - true if the element does contain the specified text or false if it does not.
  */
  var verifyContains = function(userEvent) {
      
    var elementText = $(userEvent.selector).val() || $(userEvent.selector)[0].innerHTML;
    
    if (elementText.indexOf(userEvent.text) !== -1) {
      if (window.gf.debug) console.log("PASS - element does contain specified text.");
    } else {
      if (window.gf.debug) throw new Error("FAIL - element does not contain specified text.");
    }
  };
    
  /*	Function: simulateEvent
      Replays the DOM event specified by userEvent -- uses the same event type and same coordinates that were originally recorded for the event.
    
    Parameters:
      userEvent - Object, a single DOM event from the JSON playback file. 
      
    Returns:
      Nothing.				
  */
  var simulateEvent = function(userEvent) {
    
    if (userEvent.selector in selectorHash) {
      var eventTarget = selectorHash[userEvent.selector];
    } else {
    
      if (userEvent.selector === "document") {
        var eventTarget = document;
      } else {
        var eventTarget = $(userEvent.selector)[0];
      }

      if (userEvent.hasOwnProperty("clientX") && userEvent.hasOwnProperty("clientY")) {
      
        // get the target based on the click coordinates
        var target = document.elementFromPoint(userEvent.clientX, userEvent.clientY);
        
        // verify that the target from the coordinates matches the logged CSS selector
        if (target === eventTarget) {
          if (window.gf.debug) console.log("PASS - click target matches selector element.");
          // selectorHash[userEvent.selector] = eventTarget;
        } else {
          // throw new Error("FAIL - Element at point ("+userEvent.clientX+"px, "+userEvent.clientY+"px) does not match selector " + userEvent.selector);
        }
      }
    }
    
    // console.log("Simulating scroll ("+(userEvent.timeStamp/1000).toFixed(3)+"s). Selector: " + userEvent.selector);
    
    var event = null; 
    
    switch (userEvent.type) {
      case "scroll":
        $(eventTarget).scrollLeft(userEvent.scrollLeft);
        $(eventTarget).scrollTop(userEvent.scrollTop);
        break;
      case "focusin":
      case "focusout":
      case "focus":
      case "blur":
        event = new FocusEvent(userEvent.type, userEvent);
        break;
      case "tap":
      case "click":
      case "mouseup":
      case "mousedown":
        event = new MouseEvent(userEvent.type, userEvent);
        break;
      case "touchstart":
      case "touchend":
      case "touchmove":
      case "touchcancel":
        
        var touchList = [];
        for (var i = 0; i < userEvent.touches.length; i++) {
          var touch = userEvent.touches[i];
          var newTouch = new Touch({
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
            ,"target":$(touch.selector)[0]
          });
          touchList.push(newTouch);
        }
        
        userEvent.touches = touchList;
        
        var touchList = [];
        for (var i = 0; i < userEvent.changedTouches.length; i++) {
          var touch = userEvent.changedTouches[i];
          var newTouch = new Touch({
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
            ,"target":$(touch.selector)[0]
          });
          touchList.push(newTouch);
        }
        
        userEvent.changedTouches = touchList;
      
        event = new TouchEvent(userEvent.type, userEvent);
        
        break;
      case "keypress":
      case "keydown":
      case "keyup":
        event = new KeyboardEvent(userEvent.type, userEvent);
        break;
      case "input":
        event = new Event(userEvent.type, userEvent);
        $(userEvent.selector).val(userEvent.value);
        break;
      case "contains":
        verifyContains(userEvent);
        return;
      default:
        if (window.gf.debug) throw new Error("Unsupported event type.");
        break;
    }
    
    try {
      if (event !== null) {
        eventTarget.dispatchEvent(event);
      }
    } catch (error) {
      console.error(error)
      console.log(userEvent.selector)
    }
    
  }

  return simulateEvent(userEvent)
}