const WebSocket = require('ws')
const fs = require('fs')
const path = require("path")
const { log: print } = console

const WebSocketServer = WebSocket.Server

const wss = new WebSocketServer({
  port: 4000
})

const getTimeInterval = (a, b) => {
  const ms = a ? ((new Date(b.slice(1, b.length - 1))) - (new Date(a.slice(1, a.length - 1)))) : 0
  return ms < 0 ? 100 : ms
}

const sleep = (ms) => {
  end = Date.now() + ms
  while (Date.now() <= end) { }
}

const { argv } = require('process')
const filePath = argv.at(-1).endsWith(".txt") ? argv.at(-1) : "../../data/2022-11-04__10-39-08__log.txt"
print(`[WebSocket Log] Will Read File: ${filePath} ...`)
print(`[WebSocket Log] Server Start ...`)
let beCalledNum = 0
let isCalling = false
wss.on('connection', (ws) => {  //在connection事件中，回调函数会传入一个WebSocket的实例，表示这个WebSocket连接。
  print(`[WebSocket Log] Connection Ok!`)
  ws.on('message', (message) => {  //我们通过响应message事件，在收到消息后再返回一个ECHO: xxx的消息给客户端。
    print(`[WebSocket Log] Message From Client Received: ${message}`)
    if (!isCalling) {
      isCalling = true
      sendAfterCalled(ws)
    } else {
      print(`[WebSocket Log] Please Call After This Runtime`)
    }
  })
})

const sendAfterCalled = async (ws) => {

  print(`[WebSocket Log] Reading File: ${filePath} ...`)
  const readliner = fs.createReadStream(path.join(__dirname, filePath))
  readliner.setEncoding('utf8')
  print("[WebSocket Log] Websocket Start Send Data 3 Seconds Later")
  sleep(3000)
  print("[WebSocket Log] Websocket Start Send Data Line By Line...")
  let s = Date.now()
  const statistics = { allNum: 0, successNum: 0, failNum: 0, failArr: [] }
  let preTime = ''
  let i = 0
  const sep = `{"commands":[{"`
  let preData = ""
  return new Promise(resolve => {
    readliner.on('data', (data) => {
      readliner.pause()

      let newData = preData + data
      let index = newData.lastIndexOf('\n')

      tempArray = newData.slice(0, index).trim().split('\n')
      preData = newData.slice(index + 1)

      const send = (dataArray) => {
        const msAndContentArr = dataArray.map(item => {
          const temp = item.split(sep)
          temp[1] = sep + temp[1]
          temp[0] = temp[0].trim()
          const [time, content] = temp
          const ms = getTimeInterval(preTime, time)
          preTime = time
          return { ms, content }
        })
        !(function f (msAndContentArr, k) {
          let curIndex = k
          if (curIndex < msAndContentArr.length) {
            setTimeout((j = i) => {
              ws.send((msAndContentArr[curIndex].content), (err) => {
                if (err) {
                  print('\n' + new Array(21).join('--'))
                  print(`[WebSocket Log] Send 第[${j + 1}]条 Log Error, Reason :${err}\n`)
                  statistics.failNum++
                  statistics.successNum--
                  statistics.failArr.push(content)
                }
              })
              print(`[WebSocket Log] ${msAndContentArr[curIndex].ms}ms Send 第[${j + 1}]条 log!`)
              i++
              statistics.allNum++
              statistics.successNum++
              f(msAndContentArr, ++curIndex)
            }, msAndContentArr[curIndex].ms)
          } else {
            readliner.resume()
            if (readliner.closed) {
              resolve(true)
            }
          }
        })(msAndContentArr, 0)
      }
      send(tempArray)
    })
  }).then(flag => {
    if (flag) {
      print("[WebSocket Log] Read File End!")
      print(`[WebSocket Log] Send End!`)
      print(`[WebSocket Log] Time Spend = ${((Date.now() - s) / 1000).toFixed(3)}s`)
      print(`allNum=${statistics.allNum} successNum=${statistics.successNum} failNum=${statistics.failNum} successRate=${(statistics.successNum * 100 / statistics.allNum).toFixed(2)}%`)
      print('\n' + new Array(11).join('--') + ` beCalledNum=${++beCalledNum} finished ` + new Array(11).join('--') + '\n')
    }
    isCalling = false
  }).catch(err => {
    print(`[WebSocket Log] Catch Error: ${err.message || err}`)
    isCalling = false
  })
}