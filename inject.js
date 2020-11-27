function glassFrameSetup () {
  const baseUrl = window.baseUrl.substring(0, window.baseUrl.length - 1)
  const copybugEndpoint = window.copybugEndpoint

  const attributesToTrack = ['href', 'xlink\\:href', 'data-href', 'src', 'data-src', 'srcset', 'data-srcset']
  const querySelectorPath = attributesToTrack.reduce((a, b, i) => {
    a += `*[${b}^="/"]${attributesToTrack.length - 1 === i ? '' : ', '}`
    return a
  }, '')

  window.lastPlayedEvent = null

  window.addEventListener('message', function (e) {
    if (window.lastPlayedEvent === null || window.lastPlayedEvent) {
      if (e.data.detail === 0) return

      if (window.gf.debug) console.log('GOT EVENT FROM PARENT', window.iframeId, e.data)
      playback(e.data)
      window.lastPlayedEvent = e.data
    }
  },false)

  const mutateElementAttributes = (el) => {
    let attributes = [].slice.call(el.attributes || [])
    attributes = attributes.filter(attr => attributesToTrack.includes(attr.name) && attr.value[0] === '/')
    
    if (!attributes.length) return

    attributes.forEach(attr => {
      let newUrl = window.gf.endpoint
      const isNS = ['SVG', 'USE', 'svg', 'use'].includes(el.tagName)
      const namespace = isNS ? newUrl.href : null
      newUrl += `?mainUrl=${baseUrl}`

      if (isNS) {
        let hash = attr.value.match(/#.*$/)
        if (hash && hash[0]) {
          const path = attr.value.replace(hash, '')
          newUrl += `&pathUrl=${attr.value}`
          el.setAttributeNS(attr.namespaceURI, attr.name, newUrl)
        }
      } else {
        newUrl += `&pathUrl=${attr.value}`
        el.setAttribute(attr.name, newUrl)
      }
    })
  }

  const elementsThatStartWithSlash = document.querySelectorAll(querySelectorPath)
  elementsThatStartWithSlash.forEach(mutateElementAttributes)

  let observer = new MutationObserver(mutationsList => {
    // Use traditional 'for loops' for IE 11
    mutationsList.forEach(mutation => {
      if (mutation.type === 'childList') {
        if (mutation.addedNodes.length) mutation.addedNodes.forEach(mutateElementAttributes)
      } else if (mutation.type === 'attributes') {
        if (window.gf.debug) console.log('The ' + mutation.attributeName + ' attribute was modified.');
      }
    })
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterDataOldValue: true
  });

  record((event) => parent.postMessage(Object.assign({}, event, { iframeId: window.iframeId }), window.copybugEndpoint)).start()
}

glassFrameSetup()