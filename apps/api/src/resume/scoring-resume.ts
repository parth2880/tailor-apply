import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";
import { Job } from "@prisma/client";
import { getPreferences } from "../common/config";
import { OUTPUTS_DIR, ensureDataDirs } from "../common/paths";
import { candidateResumeText } from "../matching/scorer";
import { psDownloadName } from "./filename";
import { resumeToPdf } from "./pdf";
import { ResumeData, normalizeResume } from "./schema";
import { loadMasterResumeData, masterResumeFilePath } from "./tailor";

export type ScoringResumeFile = {
  source: "tailored" | "master";
  label: string;
  filename: string;
  pdfPath: string;
};

function templateOpts() {
  const prefs = getPreferences();
  return {
    template: prefs.resume_template || "european",
    pageFormat: prefs.resume_page_format,
  };
}

function tailoredJsonPath(job: Job): string | null {
  if (!job.tailoredResumeMdPath) return null;
  return job.tailoredResumeMdPath.replace(/\.md$/i, ".json");
}

function loadTailoredData(job: Job): ResumeData | null {
  const jsonPath = tailoredJsonPath(job);
  if (jsonPath && existsSync(jsonPath)) {
    return normalizeResume(JSON.parse(readFileSync(jsonPath, "utf8")) as ResumeData);
  }
  return null;
}

export async function getScoringResume(job: Job): Promise<ScoringResumeFile | null> {
  const { source } = candidateResumeText(job);
  if (source === "none") return null;
  const opts = templateOpts();
  ensureDataDirs();

  if (source === "tailored") {
    if (job.tailoredResumePdfPath && existsSync(job.tailoredResumePdfPath)) {
      return {
        source,
        label: "Tailored resume written for this job",
        filename: psDownloadName(job.title),
        pdfPath: job.tailoredResumePdfPath,
      };
    }
    const data = loadTailoredData(job);
    if (!data) return null;
    const jsonPath = tailoredJsonPath(job);
    const pdfPath = jsonPath
      ? jsonPath.replace(/\.json$/i, ".pdf")
      : join(OUTPUTS_DIR, psDownloadName(job.title));
    await resumeToPdf(data, pdfPath, opts);
    return {
      source,
      label: "Tailored resume written for this job",
      filename: psDownloadName(job.title),
      pdfPath,
    };
  }

  const data = loadMasterResumeData();
  const yamlPath = masterResumeFilePath();
  const pdfPath = join(OUTPUTS_DIR, "PS Master Resume.pdf");
  const yamlNewer = !existsSync(pdfPath) || statSync(yamlPath).mtimeMs > statSync(pdfPath).mtimeMs;
  if (yamlNewer) {
    await resumeToPdf(data, pdfPath, opts);
  }
  return {
    source: "master",
    label: "Master resume (data/master_resume.yaml)",
    filename: psDownloadName(job.title),
    pdfPath,
  };
}
