import fs from 'fs'
import path from 'path'
import Router from '@koa/router'
import { koaBody } from 'koa-body'
import { constructFileID, FileID } from '@laibrary/types'
import type { Config } from '../config'
import type { FilePool } from '../blob/file-pool'
import pathExists, { initDirectorySync, prepareWriteDirectory } from '../utils/directory'

function backData(ctx: any, body: any, status: number = 200) {
  ctx.status = status
  ctx.type = 'application/json'
  ctx.body = JSON.stringify(body)
}

function backFail(ctx: any, status: number, message: string) {
  return backData(ctx, { message }, status)
}

function detectSingleFile(ctx: any): any {
  const { files } = ctx.request
  if (files === undefined) {
    throw new Error('upload failure, ctx.request.files === undefined')
  }
  if (Object.keys(files).length > 1) {
    throw new Error("upload failure, only require 'file' fieldname")
  }

  const file = files['file']
  if (file === undefined) {
    throw new Error("upload failure, require 'file' fieldname")
  } else if (Array.isArray(file)) {
    throw new Error('upload failure, require single upload')
  }

  return file
}

export function singleUploadRouter(config: Config, blob: FilePool) {
  const router = new Router()

  initDirectorySync(config.upload_temp_path)
  const temp_files = fs.readdirSync(config.upload_temp_path)
  for (const temp_file of temp_files) {
    const temp_path = path.join(config.upload_temp_path, temp_file)
    try {
      fs.unlinkSync(temp_path)
    } catch (err) {
      console.error(`清除上传残留失败: ${temp_path}`, err)
    }
  }

  const singleFileUpload = koaBody({
    multipart: true,
    formidable: {
      maxFileSize: Infinity,
      multiples: false,
      maxFiles: 1,
      maxFields: 1,
      allowEmptyFiles: false,
      keepExtensions: true,
      uploadDir: config.upload_temp_path,
      filter: (part: any) => part.name === 'file',
    },
  })

  router.post('file', singleFileUpload, async (ctx) => {
    try {
      const uploaded = detectSingleFile(ctx)

      const f_num = await blob.requestFileNumber()
      const f_id_extname = path.extname(uploaded.originalFilename || '').replace('.', '')

      const file_id = constructFileID(f_num, f_id_extname)
      const new_file_write_path = blob.getFilePath(file_id)
      await prepareWriteDirectory(new_file_write_path)
      await fs.promises.rename(uploaded.filepath, new_file_write_path)

      return backData(ctx, file_id, 200)
    } catch (err: any) {
      return backFail(ctx, 500, `upload failure: ${err.message}`)
    }
  })

  router.post('file/:file_id', singleFileUpload, async (ctx) => {
    try {
      const uploaded = detectSingleFile(ctx)
      const { file_id } = ctx.params
      if ((typeof file_id === 'string') && file_id.length) {
        if (await blob.fileExists(file_id as FileID)) {
          const source_file_path = blob.getFilePath(file_id as FileID)
          await fs.promises.unlink(source_file_path)
          await fs.promises.rename(uploaded.filepath, source_file_path)
          return backData(ctx, file_id, 200)
        } else {
          await fs.promises.unlink(uploaded.filepath)
          return backFail(ctx, 400, `file(id=${file_id}) not found`)
        }
      } else {
        await fs.promises.unlink(uploaded.filepath)
        return backFail(ctx, 400, 'illegal file_id')
      }
    } catch (err: any) {
      return backFail(ctx, 500, `upload failure: ${err.message}`)
    }
  })

  router.delete('file/:file_id', async (ctx) => {
    const { file_id } = ctx.params
    if (typeof file_id === 'string') {
      const file_path = blob.getFilePath(file_id as FileID)
      if (await pathExists(file_path)) {
        await fs.promises.unlink(file_path)
        backData(ctx, { message: 'done' }, 200)
      } else {
        backFail(ctx, 404, `file not found(file_id=${file_id})`)
      }
    } else {
      backFail(ctx, 400, 'require file_id')
    }
  })

  router.get('readfile/:file_id', async (ctx) => {
    const { file_id } = ctx.params
    if (typeof file_id === 'string') {
      const file_path = blob.getFilePath(file_id as FileID)
      if (await pathExists(file_path)) {
        ctx.body = fs.createReadStream(file_path)
      } else {
        backFail(ctx, 404, `file not found(file_id=${file_id})`)
      }
    }
  })

  return router
}
