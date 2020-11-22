window.lastPlayedEvent = null

window.addEventListener('message', function (e) {
  if (window.lastPlayedEvent === null || window.lastPlayedEvent) {
    if (e.data.detail === 0) return

    console.log('GOT EVENT FROM PARENT', window.iframeId, e.data)
    playback(e.data)
    window.lastPlayedEvent = e.data
  }
},false)

const recordCallback = (event) => {
  parent.postMessage(
    Object.assign({}, event, { iframeId: window.iframeId }),
    'http://localhost:3030'
  )
}

record(recordCallback).start()