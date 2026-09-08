import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
  deleteResumeProfile,
  importResumeFromText,
  listResumeProfiles,
  setActiveResume,
} from "./profiles";
import { clearLlmOverride, setLlmOverride } from "../llm/llm";

type CreateBody = {
  name?: string;
  text?: string;
  llm_provider?: string;
  llm_model?: string;
};

async function bufferToText(file?: Express.Multer.File): Promise<string> {
  if (!file?.buffer?.length) return "";
  const name = (file.originalname || "").toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();
  if (name.endsWith(".pdf") || mime.includes("pdf")) {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: file.buffer });
    const parsed = await parser.getText();
    return (parsed.text || "").trim();
  }
  return file.buffer.toString("utf8");
}

function httpError(exc: unknown): never {
  const message = exc instanceof Error ? exc.message : String(exc);
  const status =
    /not found/i.test(message) ? HttpStatus.NOT_FOUND : /cannot be deleted|Keep at least/i.test(message) ? HttpStatus.BAD_REQUEST : HttpStatus.BAD_REQUEST;
  throw new HttpException({ detail: message, message }, status);
}

@Controller("api/resumes")
export class ResumesController {
  @Get()
  list() {
    try {
      return listResumeProfiles();
    } catch (exc) {
      httpError(exc);
    }
  }

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  async create(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: CreateBody) {
    const textFromFile = await bufferToText(file).catch((exc) => {
      throw new HttpException(
        { detail: exc instanceof Error ? exc.message : "Could not read that file", message: "Could not read that file" },
        HttpStatus.BAD_REQUEST,
      );
    });
    const text = (body.text || "").trim() || textFromFile;
    if (body.llm_provider) setLlmOverride(body.llm_provider, body.llm_model || null);
    try {
      return await importResumeFromText({ name: body.name, text });
    } catch (exc) {
      httpError(exc);
    } finally {
      clearLlmOverride();
    }
  }

  @Post(":id/activate")
  activate(@Param("id") id: string) {
    try {
      return setActiveResume(id);
    } catch (exc) {
      httpError(exc);
    }
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    try {
      return deleteResumeProfile(id);
    } catch (exc) {
      httpError(exc);
    }
  }
}
