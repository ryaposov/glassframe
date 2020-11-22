const fs = require('fs')
const path = require('path')
const express = require('express')
const proxy = require('express-http-proxy');
const cookieParser = require('cookie-parser')
const fetch = require('node-fetch')
const cors = require('cors')
const { response } = require('express');
const { url } = require('inspector');
const app = express()
const port = 3032
const endpoint = process.env.NODE_ENV === 'development' ? 'http://localhost:3030' : ''
const endpointEscaped = process.env.NODE_ENV === 'development' ? 'http:\/\/localhost:3032' : ''

app.use(cors({
  origin: endpoint,
  credentials: true
}))

app.use(cookieParser())

function selectProxyHost (req) {
  const dirtyUrl = req.cookies.mainUrl.includes(req.originalUrl) ? req.cookies.mainUrl : req.cookies.mainUrl + req.originalUrl; 
  const url = new URL(dirtyUrl)
  req.iframeId = url.searchParams.get('iframeId')
  url.searchParams.delete('iframeId')

  return dirtyUrl
}

function modifyURLs (data, userReq) {
  const token = endpoint
  const tokenEscaped = endpointEscaped
  let content = data.toString('utf-8').trim()

  let escapedRegex = new RegExp(userReq.cookies.mainUrl.replace(/\//g, '\\/')).toString()
  escapedRegex = escapedRegex.substring(1, escapedRegex.length - 1)

  let searchIndex = 0;
  do {
      content = content.replace(escapedRegex, tokenEscaped);
  } while((searchIndex = content.indexOf(token, searchIndex + 1)) > -1);

  content = content
    .replace(escapedRegex, token)
    .replace(new RegExp(userReq.cookies.mainUrl, 'g'), token)
    .replace(/src="\//g, `src="${token}/`)
    .replace(/data-src="\//g, `data-src="${token}/`)
    .replace(/srcset="\//g, `srcset="${token}/`)
    .replace(/data-srcset="\//g, `data-srcset="${token}/`)
    .replace(/url\("\//g, `url("${token}/`)
    .replace(/url\(\//g, `url(${token}/`)

  return content
}

function injectJS (html, id) {
  const record = fs.readFileSync(path.resolve('./record.js'), 'utf8')
  const playback = fs.readFileSync(path.resolve('./playback.js'), 'utf8')
  const js = fs.readFileSync(path.resolve('./inject.js'), 'utf8')
  let content = html
  const script = `
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
    <script type="application/javascript">
      window.iframeId = "${id}"; 
      ${playback}
      ${record}
      ${js}
    </script>
  `
  content = content.replace('</html>', script + '</html>')

  return content
}

app.use('/', proxy(selectProxyHost, {
  proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
    // you can update headers
    proxyReqOpts.headers['referer'] = srcReq.cookies.mainUrl;

    return proxyReqOpts;
  },
  userResHeaderDecorator(headers, userReq, userRes, proxyReq, proxyRes) {
    if (headers['location']) {
      // console.log(headers['location'], userReq.originalUrl, userReq.cookies.mainUrl.replace(userReq.originalUrl, ''))
      headers['location'] = headers['location'].replace(userReq.cookies.mainUrl.replace(userReq.originalUrl, ''), 'http://localtion:3032')
    }

    return headers
  },
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
    return new Promise(function(resolve) {
      const contentType = userRes.get('Content-Type')
      let content = proxyResData

      userRes.removeHeader('X-Frame-Options')
      // userRes.statusCode = 200
      
      if (contentType && contentType.includes('text') || contentType.includes('application')) {
        content = modifyURLs(content, userReq)
        content = injectJS(content, userReq.iframeId)
      }

      resolve(content);
    });
  }
}));

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})
