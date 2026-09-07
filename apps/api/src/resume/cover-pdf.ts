import { existsSync, readFileSync, statSync } from "fs";
import { Job } from "@prisma/client";
import { getPreferences } from "../common/config";
import { coverLetterDownloadName } from "./filename";
import { coverLetterToPdf } from "./pdf";
import { loadMasterResumeData } from "./tailor";

export async function getCoverLetterPdf(job: Job): Promise<{ path: string; filename: string } | null> {
  if (!job.coverLetterPath || !existsSync(job.coverLetterPath)) return null;
  const body = readFileSync(job.coverLetterPath, "utf8").trim();
  if (!body) return null;

  const pdfPath = job.coverLetterPath.replace(/\.txt$/i, ".pdf");
  const needsBuild = !existsSync(pdfPath) || statSync(job.coverLetterPath).mtimeMs > statSync(pdfPath).mtimeMs;
  if (needsBuild) {
    const master = loadMasterResumeData();
    const prefs = getPreferences();
    const fmt = (prefs.resume_page_format || "A4").toUpperCase() === "LETTER" ? "Letter" : "A4";
    await coverLetterToPdf(
      {
        name: master.name,
        headline: master.headline,
        jobTitle: job.title,
        company: job.company,
        body,
      },
      pdfPath,
      fmt,
    );
  }
  return { path: pdfPath, filename: coverLetterDownloadName(job.title) };
}
