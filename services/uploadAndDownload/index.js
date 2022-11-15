const fse = require('fs-extra')
const fs = require('fs')
const path = require("path")
const { koaBody } = require('koa-body')
const Router = require('koa-router')
const Koa = require('koa')
const cors = require('koa2-cors')
//const send = require('koa-send')
const { log: print } = console

const app = new Koa()
const uploadDirTemp = path.resolve(__dirname, 'upload/temp')
const uploadDirLast = path.resolve(__dirname, 'upload')
let fileName
app.use(cors())

const router = new Router()
app.use(async function (ctx, next) {
  if (ctx.URL.pathname === "/upload") {
    fse.ensureDirSync(uploadDirTemp)
  }
  await next()
})

// TODO 失败重传当前chunk，断点续传
router.post('/upload', koaBody({
  multipart: true,
  formidable: {
    uploadDir: uploadDirTemp,
    keepExtensions: true,
    maxFieldsSize: 2 * 1024 * 1024
  }
}), async (ctx, next) => {
  if (ctx.request?.body === "upload completed") {
    const chunkDir = path.join(uploadDirTemp, fileName)
    const chunks = await fse.readdir(chunkDir)
    chunks.sort((a, b) => {
      return a.split('.').at(-2) - b.split('.').at(-2)
    }).map(chunkPath => {
      fse.appendFileSync(
        path.join(uploadDirLast, fileName),
        fse.readFileSync(`${chunkDir}/${chunkPath}`)
      )
    })
    fse.removeSync(chunkDir)
    fse.removeSync(uploadDirTemp)
  } else {
    const file = ctx.request?.files.file
    const a = file?.originalFilename.lastIndexOf('.')
    const b = file?.originalFilename.slice(0, a).lastIndexOf('.')
    const fDir = file?.originalFilename.slice(0, a).slice(0, b)
    fileName = fDir + file?.originalFilename.slice(a)
    const chunkDir = `${uploadDirTemp}/${fileName}`

    if (!fse.existsSync(chunkDir)) {
      await fse.mkdirs(chunkDir)
    }
    const dPath = path.join(chunkDir, file.originalFilename)
    await fse.move(file.filepath, dPath, { overwrite: true })
  }
  ctx.body = { code: 0, message: 'ok' }
})

router.get('/download/:fileName', async (ctx, next) => {
  const downPath = path.resolve(__dirname, `../../data/${ctx.request.params.fileName}`)
  // ctx.attachment(downPath)
  print(downPath)
  // let a = await send(ctx, downPath)
  if (ctx.request.method === 'GET' && ctx.URL.pathname.startsWith('/download/')) {
    const size = fse.statSync(downPath).size
    const headers = {
      'Content-type': 'application/octet-stream',
      'Content-Disposition': `attachment;filename=${ctx.request.params.fileName}`,
      'Content-Length': size
    }
    ctx.set(headers)
    ctx.body = fs.createReadStream(downPath)
  }
  await next()
})

app.use(router.routes()).use(router.allowedMethods())

app.listen(5000, () => {
  print("Server running on port 5000")
})
