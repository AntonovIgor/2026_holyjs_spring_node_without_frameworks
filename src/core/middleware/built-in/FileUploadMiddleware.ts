import formidable, {
  errors as formidableErrors,
  type File as FormidableFile,
  type Options as FormidableOptions,
} from 'formidable';

import { createReadStream, type ReadStream } from 'node:fs';

import type { Middleware, Next } from '../types.js';
import type { Request } from '../../http/Request.js';
import type { Response } from '../../http/Response.js';
import { BadRequestException } from '../../exception/HttpException.js';

/** Описание загруженного файла, доступное в обработчике маршрута. */
export interface UploadedFile {
  filename: string;
  mimetype: string;
  filepath: string;
  size: number;
  createReadStream(): ReadStream;
}

/** Результат парсинга multipart/form-data. */
export interface ParsedMultipart {
  fields: Record<string, string>;
  files: Record<string, UploadedFile>;
}

/** Ключ для доступа к загруженным файлам из Request.extras. */
export const MULTIPART_KEY = Symbol('multipart');

/** Настройки FileUploadMiddleware. */
export interface FileUploadOptions {
  maxFileSize?: number;
  uploadDir?: string;
}

/**
 * Обрабатывает загрузку файлов через multipart/form-data.
 *
 * Использует библиотеку formidable для разбора multipart-запросов.
 * Результат (поля и файлы) сохраняется в Request по ключу MULTIPART_KEY.
 * Если запрос не multipart — middleware пропускает его без обработки.
 */
export class FileUploadMiddleware implements Middleware {
  readonly name = 'FileUploadMiddleware';

  private readonly maxFileSize: number;
  private readonly uploadDir: string | undefined;

  constructor(options: FileUploadOptions = {}) {
    this.maxFileSize = options.maxFileSize ?? 10_485_760;
    this.uploadDir = options.uploadDir;
  }

  async handle(req: Request, res: Response, next: Next): Promise<void> {
    const contentType = (req.headers['content-type'] as string | undefined) ?? '';

    if (!contentType.startsWith('multipart/form-data')) {
      return next();
    }

    const parsed = await this.parseMultipart(req);
    req.set(MULTIPART_KEY, parsed);
    await next();
  }

  private async parseMultipart(req: Request): Promise<ParsedMultipart> {
    const options: FormidableOptions = {
      maxFileSize: this.maxFileSize,
      maxTotalFileSize: this.maxFileSize,
    };

    if (this.uploadDir !== undefined) {
      options.uploadDir = this.uploadDir;
    }

    const form = formidable(options);

    let fields: Record<string, string[] | undefined>;
    let files: Record<string, FormidableFile | FormidableFile[]>;

    try {
      [fields, files] = await form.parse(req.raw) as [
        Record<string, string[] | undefined>,
        Record<string, FormidableFile | FormidableFile[]>,
      ];
    } catch (error) {
      throw this.mapUploadError(error);
    }

    return {
      fields: this.normalizeFields(fields),
      files: this.normalizeFiles(files),
    };
  }

  private normalizeFields(fields: Record<string, string[] | undefined>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [name, values] of Object.entries(fields)) {
      const value = values?.[0];
      if (value !== undefined) {
        result[name] = value;
      }
    }

    return result;
  }

  private normalizeFiles(
    files: Record<string, FormidableFile | FormidableFile[]>,
  ): Record<string, UploadedFile> {
    const result: Record<string, UploadedFile> = {};

    for (const [name, value] of Object.entries(files)) {
      const file = Array.isArray(value) ? value.at(0) : value;
      if (!file) {
        continue;
      }

      result[name] = {
        filename: file.originalFilename ?? file.newFilename,
        mimetype: file.mimetype ?? 'application/octet-stream',
        filepath: file.filepath,
        size: file.size,
        createReadStream: (): ReadStream => createReadStream(file.filepath),
      };
    }

    return result;
  }

  private mapUploadError(error: unknown): BadRequestException {
    if (error instanceof Error && 'code' in error) {
      switch (error.code) {
        case formidableErrors.missingMultipartBoundary:
          return new BadRequestException('Missing multipart boundary');
        case formidableErrors.malformedMultipart:
          return new BadRequestException('Invalid multipart/form-data body');
        case formidableErrors.biggerThanMaxFileSize:
        case formidableErrors.biggerThanTotalMaxFileSize:
          return new BadRequestException('Uploaded file exceeds size limit');
        case formidableErrors.noEmptyFiles:
        case formidableErrors.smallerThanMinFileSize:
          return new BadRequestException('Empty file uploads are not allowed');
        default:
          return new BadRequestException('Multipart parsing failed');
      }
    }

    return new BadRequestException('Invalid multipart/form-data body');
  }
}
