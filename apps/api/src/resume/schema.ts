export type EducationEntry = {
  school: string;
  location?: string;
  degree?: string;
  dates?: string;
  details?: string[];
};

export type ExperienceEntry = {
  company: string;
  location?: string;
  title?: string;
  dates?: string;
  bullets?: string[];
};

export type ProjectEntry = {
  name: string;
  location?: string;
  title?: string;
  dates?: string;
  bullets?: string[];
};

export type SkillGroup = { label: string; items?: string };

export type ResumeData = {
  name: string;
  headline?: string;
  profile?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  education?: EducationEntry[];
  experience?: ExperienceEntry[];
  projects?: ProjectEntry[];
  skill_groups?: SkillGroup[];
  skills?: string;
  languages?: string;
  interests?: string;
};

export function contactItems(resume: ResumeData): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  if (resume.location) items.push({ label: "Location", value: resume.location });
  if (resume.email) items.push({ label: "Email", value: resume.email });
  if (resume.phone) items.push({ label: "Phone", value: resume.phone });
  if (resume.linkedin) items.push({ label: "LinkedIn", value: resume.linkedin });
  if (resume.github) items.push({ label: "GitHub", value: resume.github });
  if (resume.portfolio) items.push({ label: "Portfolio", value: resume.portfolio });
  return items;
}

export function contactLine(resume: ResumeData): string {
  return [resume.location, resume.linkedin, resume.phone, resume.email, resume.github, resume.portfolio]
    .filter(Boolean)
    .join(" | ");
}

export function resumeToMarkdown(resume: ResumeData): string {
  const lines = [`# ${resume.name}`, "", `**${resume.headline || ""}**`, contactLine(resume), ""];
  if (resume.profile) lines.push("## PROFILE", "", resume.profile, "");
  if (resume.skill_groups?.length) {
    lines.push("## TECHNICAL SKILLS", "");
    for (const g of resume.skill_groups) lines.push(`**${g.label}:** ${g.items || ""}`);
    lines.push("");
  } else if (resume.skills) {
    lines.push("## TECHNICAL SKILLS", "", resume.skills, "");
  }
  lines.push("## PROFESSIONAL EXPERIENCE", "");
  for (const exp of resume.experience || []) {
    lines.push(`**${exp.company}** — ${exp.location || ""}`);
    lines.push(`*${exp.title || ""}* · ${exp.dates || ""}`);
    for (const b of exp.bullets || []) lines.push(`- ${b}`);
    lines.push("");
  }
  if (resume.projects?.length) {
    lines.push("## KEY PROJECTS", "");
    for (const proj of resume.projects) {
      lines.push(`**${proj.name}** — ${proj.location || ""}`);
      const titleDates = [proj.title, proj.dates].filter(Boolean).join(" · ");
      if (titleDates) lines.push(`*${titleDates}*`);
      for (const b of proj.bullets || []) lines.push(`- ${b}`);
      lines.push("");
    }
  }
  lines.push("## EDUCATION", "");
  for (const edu of resume.education || []) {
    lines.push(`**${edu.school}** — ${edu.location || ""}`);
    lines.push(`*${edu.degree || ""}* · ${edu.dates || ""}`.replace(/^ ·|· $/, ""));
    for (const d of edu.details || []) lines.push(`- ${d}`);
    lines.push("");
  }
  if (resume.languages || resume.interests) {
    lines.push("## LANGUAGES & INTERESTS", "");
    if (resume.languages) lines.push(`**Languages:** ${resume.languages}`);
    if (resume.interests) lines.push(`**Interests:** ${resume.interests}`);
    lines.push("");
  }
  return lines.join("\n");
}

export function normalizeResume(data: Partial<ResumeData> & { name?: string }): ResumeData {
  return {
    name: data.name || "",
    headline: data.headline || "",
    profile: data.profile || "",
    email: data.email || "",
    phone: data.phone || "",
    location: data.location || "",
    linkedin: data.linkedin || "",
    github: data.github || "",
    portfolio: data.portfolio || "",
    education: data.education || [],
    experience: data.experience || [],
    projects: data.projects || [],
    skill_groups: data.skill_groups || [],
    skills: data.skills || "",
    languages: data.languages || "",
    interests: data.interests || "",
  };
}
