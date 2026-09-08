import { existsSync, readFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import Handlebars from "handlebars";
import { chromium } from "playwright";
import { assertChromiumAvailable, wrapPlaywrightLaunch } from "../common/browser";
import { contactItems, contactLine, ResumeData } from "./schema";

const TEMPLATES_DIR = join(__dirname, "templates");
const SRC_TEMPLATES_DIR = join(__dirname, "..", "..", "src", "resume", "templates");

function compile(name: string) {
  const fromDist = join(TEMPLATES_DIR, name);
  const fromSrc = join(SRC_TEMPLATES_DIR, name);
  const path = existsSync(fromDist) ? fromDist : fromSrc;
  const src = readFileSync(path, "utf8");
  return Handlebars.compile(src);
}

export function resumeToHtml(resume: ResumeData, template = "european"): string {
  const file = template === "european" ? "european.hbs" : "classic.hbs";
  const tpl = compile(file);
  return tpl({
    ...resume,
    contactItems: contactItems(resume),
    contactLine: contactLine(resume),
  });
}

async function htmlToPdf(
  html: string,
  outputPath: string,
  pageFormat: "A4" | "Letter",
): Promise<string> {
  mkdirSync(dirname(outputPath), { recursive: true });
  const margins =
    pageFormat === "A4"
      ? { top: "16mm", bottom: "14mm", left: "16mm", right: "16mm" }
      : { top: "0.5in", bottom: "0.5in", left: "0.55in", right: "0.55in" };
  assertChromiumAvailable();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (exc) {
    wrapPlaywrightLaunch(exc);
  }
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: outputPath,
      format: pageFormat,
      margin: margins,
      printBackground: true,
    });
  } finally {
    await browser.close();
  }
  return outputPath;
}

export async function resumeToPdf(
  resume: ResumeData,
  outputPath: string,
  opts: { template?: string; pageFormat?: string | null } = {},
): Promise<string> {
  const template = opts.template || "european";
  const fmt = (opts.pageFormat || (template === "european" ? "A4" : "Letter")).toUpperCase() as
    | "A4"
    | "Letter";
  return htmlToPdf(resumeToHtml(resume, template), outputPath, fmt);
}

function coverParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function coverLetterToHtml(input: {
  name: string;
  headline?: string;
  jobTitle: string;
  company?: string;
  body: string;
}): string {
  const tpl = compile("cover.hbs");
  return tpl({
    name: input.name,
    headline: input.headline || "",
    jobTitle: input.jobTitle,
    company: input.company || "",
    date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
    paragraphs: coverParagraphs(input.body),
  });
}

export async function coverLetterToPdf(
  input: {
    name: string;
    headline?: string;
    jobTitle: string;
    company?: string;
    body: string;
  },
  outputPath: string,
  pageFormat: "A4" | "Letter" = "A4",
): Promise<string> {
  return htmlToPdf(coverLetterToHtml(input), outputPath, pageFormat);
}
