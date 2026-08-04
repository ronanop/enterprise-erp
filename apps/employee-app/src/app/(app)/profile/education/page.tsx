"use client";

import { useCallback, useEffect, useState } from "react";
import { AppHeader } from "@/components/app-header";
import { AiFab, EmptyState } from "@/components/ui";
import { essService } from "@/services/ess-service";
import type { EssEducationItem, EssEducationSkills, EssSkillItem } from "@/types/api";
import * as ui from "@/theme/classes";

export default function EducationSkillsPage() {
  const [data, setData] = useState<EssEducationSkills>({ education: [], skills: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [degree, setDegree] = useState("");
  const [institution, setInstitution] = useState("");
  const [skillName, setSkillName] = useState("");
  const [skillLevel, setSkillLevel] = useState("intermediate");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await essService.educationSkills();
      setData(res.data ?? { education: [], skills: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function persist(next: EssEducationSkills) {
    setSaving(true);
    setError(null);
    try {
      const res = await essService.updateEducationSkills(next);
      setData(res.data ?? next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addEducation() {
    if (!degree.trim()) return;
    const row: EssEducationItem = {
      id: crypto.randomUUID(),
      degree: degree.trim(),
      institution: institution.trim() || null,
    };
    await persist({ ...data, education: [row, ...data.education] });
    setDegree("");
    setInstitution("");
  }

  async function addSkill() {
    if (!skillName.trim()) return;
    const row: EssSkillItem = {
      id: crypto.randomUUID(),
      name: skillName.trim(),
      level: skillLevel,
    };
    await persist({ ...data, skills: [row, ...data.skills] });
    setSkillName("");
  }

  async function removeEducation(id?: string | null) {
    await persist({
      ...data,
      education: data.education.filter((e) => e.id !== id),
    });
  }

  async function removeSkill(id?: string | null) {
    await persist({
      ...data,
      skills: data.skills.filter((s) => s.id !== id),
    });
  }

  return (
    <div className="space-y-5">
      <AppHeader title="Education & Skills" />

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <section className={`${ui.card} space-y-3 p-5`}>
        <h2 className="text-lg font-semibold text-[#0b1c30]">Education</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={ui.input}
            placeholder="Degree / qualification"
            value={degree}
            onChange={(e) => setDegree(e.target.value)}
          />
          <input
            className={ui.input}
            placeholder="Institution"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
          />
        </div>
        <button
          type="button"
          className={ui.btn}
          disabled={saving || !degree.trim()}
          onClick={() => void addEducation()}
        >
          Add education
        </button>
        {loading ? (
          <p className="text-sm text-[#434655]">Loading…</p>
        ) : data.education.length === 0 ? (
          <EmptyState title="No education on file" />
        ) : (
          <ul className="space-y-2">
            {data.education.map((e) => (
              <li
                key={e.id ?? e.degree}
                className="flex items-start justify-between gap-3 rounded-lg border border-[#e6e8ee] px-3 py-2"
              >
                <div>
                  <p className="font-medium text-[#0b1c30]">{e.degree}</p>
                  <p className="text-sm text-[#434655]">{e.institution || "—"}</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => void removeEducation(e.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${ui.card} space-y-3 p-5`}>
        <h2 className="text-lg font-semibold text-[#0b1c30]">Skills</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className={ui.input}
            placeholder="Skill name"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
          />
          <select
            className={ui.input}
            value={skillLevel}
            onChange={(e) => setSkillLevel(e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>
        <button
          type="button"
          className={ui.btn}
          disabled={saving || !skillName.trim()}
          onClick={() => void addSkill()}
        >
          Add skill
        </button>
        {loading ? (
          <p className="text-sm text-[#434655]">Loading…</p>
        ) : data.skills.length === 0 ? (
          <EmptyState title="No skills on file" />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {data.skills.map((s) => (
              <li
                key={s.id ?? s.name}
                className="inline-flex items-center gap-2 rounded-full border border-[#e6e8ee] bg-[#f7f8fa] px-3 py-1 text-sm"
              >
                <span>
                  {s.name}
                  {s.level ? ` · ${s.level}` : ""}
                </span>
                <button
                  type="button"
                  className="text-xs text-red-600"
                  onClick={() => void removeSkill(s.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AiFab />
    </div>
  );
}
