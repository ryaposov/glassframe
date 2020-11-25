const fs = require('fs')
const path = require('path')
const express = require('express')
const proxy = require('express-http-proxy');
const cookieParser = require('cookie-parser')
const fetch = require('node-fetch')
const cors = require('cors')
const { response } = require('express');
const { url } = require('inspector');
const { DH_CHECK_P_NOT_SAFE_PRIME } = require('constants');
const app = express()
const port = 3032
const endpoint = process.env.NODE_ENV === 'production' ? 'https://glassframe.ryaposov.com' : 'http://localhost:3032'
const endpointEscaped = process.env.NODE_ENV === 'production' ? 'https://glassframe.ryaposov.com' : 'http:\/\/localhost:3032'
const copybugEndpoint = process.env.NODE_ENV === 'production' ? 'https://copybug.ryaposov.com' : 'http://localhost:3030'

app.use(cors({
  origin: endpoint,
  credentials: true
}))

// app.get('/', function (req, res, next) {
//   if (req.cookies.mainUrl) {
//     next()
//   } else {
//     res.status(500).send({ error: 'Invalid URL configuration.' })
//   }
// })

app.get('/', function (req, res, next) {
  let url = new URL(endpoint + req.originalUrl)

  req.iframeId = url.searchParams.get('iframeId')
  req.fullUrl = url.searchParams.get('fullUrl')
  req.mainUrl = url.searchParams.get('mainUrl')
  req.pathUrl = url.searchParams.get('pathUrl')

  url.searchParams.delete('fullUrl')
  url.searchParams.delete('mainUrl')
  url.searchParams.delete('pathUrl')
  url.searchParams.delete('iframeId')
  
  if (req.fullUrl) {
    req.fullUrl = new URL(req.fullUrl).href
  } else {
    req.mainUrl = new URL(req.mainUrl).href
  }

  next()
})

app.use(cookieParser())

function selectProxyHost (req) {
  return req.mainUrl
}

function modifyURLs (data, userReq, contentType) {
  const mainUrl = userReq.mainUrl
  const token = `${endpoint}/?mainUrl=${mainUrl}&pathUrl=`
  const tokenEscaped = `${endpointEscaped}/?mainUrl=${mainUrl}&pathUrl=`
  let content = data.toString('utf-8').trim()

  let escapedRegex = new RegExp(userReq.mainUrl.replace(/\//g, '\\/')).toString()
  escapedRegex = escapedRegex.substring(1, escapedRegex.length - 1)

  let searchIndex = 0;
  do {
      content = content.replace(escapedRegex, tokenEscaped);
  } while(content.indexOf(escapedRegex, searchIndex + 1) > -1);

  if (contentType.includes('css')) {
    const iterations = content.match(/((?:[..]+\/)*)(?!=[a-z])/g).filter(item => item.includes('.'))

    for (let index = 0; index < iterations.length; index++) {
      const i = content.indexOf(iterations[index])
      const length = iterations[index].length
      const depth = iterations[index].split('/').length - 1
      let path = userReq.pathUrl.split('/').filter(str => str)
      path = path.slice(0, path.length - 1)
      path.splice(path.length - depth, depth)
      path = path.join('/')
      path = (path.charAt(0) === '/' ? '' : '/') + path + '/'
      content = content.substring(0, i) + path + content.substring(i + length)
    }
  }

  content = content
    .replace(/="\/\//g, `="https://`)
    .replace(/url\(\/\//g, `url(https://`)
    .replace(escapedRegex, token)
    .replace(new RegExp(mainUrl, 'g'), token)
    .replace(/href="\//g, `href="${token}/`)
    .replace(/data-href="\//g, `data-href="${token}/`)
    .replace(/src="\//g, `src="${token}/`)
    .replace(/data-src="\//g, `data-src="${token}/`)
    .replace(/srcset="\//g, `srcset="${token}/`)
    .replace(/data-srcset="\//g, `data-srcset="${token}/`)
    .replace(/url\("\//g, `url("${token}/`)
    .replace(/url\(\//g, `url(${token}/`)

  return content
}

function injectJS (html, userReq) {
  const record = fs.readFileSync(path.resolve('./record.js'), 'utf8')
  const playback = fs.readFileSync(path.resolve('./playback.js'), 'utf8')
  const js = fs.readFileSync(path.resolve('./inject.js'), 'utf8')
  let content = html
  const script = `
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
    <script type="application/javascript">
      window.iframeId = "${userReq.iframeId}"; 
      ${playback}
      ${record}
      window.copybugEndpoint = "${copybugEndpoint}"
      ${js}
    </script>
  `

  const baseUrl = `${endpoint}/test/`

  const base = `
    <base href="${baseUrl}">
  `
  content = content
    .replace('</head>', base + '</head>')
    .replace('</html>', script + '</html>')

  return content
}

app.use('/', proxy(selectProxyHost, {
  proxyReqPathResolver: function (req) {
    return req.pathUrl || ''
  },
  proxyReqOptDecorator: function(proxyReqOpts, srcReq) {
    proxyReqOpts.headers['referer'] = srcReq.mainUrl;
    proxyReqOpts.headers['user-agent'] = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1';
    proxyReqOpts.headers['Content-Security-Policy'] = "default-src *  data: blob: filesystem: about: ws: wss: 'unsafe-inline' 'unsafe-eval' 'unsafe-dynamic'; script-src * data: blob: 'unsafe-inline' 'unsafe-eval'; connect-src * data: blob: 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src * data: blob: ; style-src * data: blob: 'unsafe-inline'; font-src * data: blob: 'unsafe-inline'";

    return proxyReqOpts;
  },
  userResHeaderDecorator(headers, userReq, userRes, proxyReq, proxyRes) {
    if (headers['location']) {
      headers['location'] = endpoint + userReq.pathUrl
    }

    return headers
  },
  userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
    return new Promise(function(resolve) {
      const contentType = userRes.get('Content-Type')
      let content = proxyResData

      userRes.removeHeader('X-Frame-Options')
      if (userRes.statusCode == 301) {
        userRes.statusCode = 200
      }
      
      if (contentType && (contentType.includes('text') || contentType.includes('application'))) {
        content = modifyURLs(content, userReq, contentType)
        content = injectJS(content, userReq)
      }

      resolve(content);
    });
  }
}));

app.listen(process.env.PORT || port, () => {
  console.log(`Example app listening at http://localhost:${process.env.PORT || port}`)
})
