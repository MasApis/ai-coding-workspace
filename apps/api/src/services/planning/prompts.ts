export interface SectionSpec {
  heading: string;
  instruction: string;
}

export interface PlanTypeSpec {
  defaultTitle: string;
  sections: SectionSpec[];
  validate: (markdown: string) => string | null;
}

function needsFr(markdown: string): string | null {
  return /FR-\d+/i.test(markdown) ? null : "PRD harus memuat identifier kebutuhan (FR-1, FR-2, …)";
}

function needsAcceptance(markdown: string): string | null {
  return /penerimaan|acceptance/i.test(markdown) ? null : "Tugas harus memuat kriteria penerimaan";
}

export const PLAN_TYPE_SPECS: Record<string, PlanTypeSpec> = {
  PROJECT_BRIEF: {
    defaultTitle: "Brief Proyek",
    sections: [
      { heading: "Ringkasan", instruction: "Ringkas ide aplikasi dalam 3-5 kalimat." },
      { heading: "Tujuan", instruction: "Tulis 2-4 tujuan terukur yang ingin dicapai." },
      { heading: "Pengguna", instruction: "Deskripsikan persona pengguna utama dan kebutuhan mereka." },
      { heading: "Cakupan", instruction: "Bagi menjadi 'Termasuk MVP' dan 'Di luar cakupan' sebagai dua daftar." },
    ],
    validate: () => null,
  },
  PRD: {
    defaultTitle: "PRD",
    sections: [
      { heading: "Latar Belakang", instruction: "Jelaskan masalah dan konteks dalam 1-2 paragraf." },
      { heading: "Tujuan", instruction: "Tulis tujuan produk yang spesifik dan terukur." },
      { heading: "Kebutuhan Fungsional", instruction: "Daftar kebutuhan bernomor FR-1, FR-2, dst. dengan satu kalimat jelas per item." },
      { heading: "Non-Fungsional", instruction: "Tulis batasan kinerja, keamanan, dan aksesibilitas." },
      { heading: "Risiko", instruction: "Daftar 3-5 risiko utama beserta mitigasinya." },
    ],
    validate: needsFr,
  },
  USER_FLOW: {
    defaultTitle: "Alur Pengguna",
    sections: [
      { heading: "Aktor", instruction: "Daftar aktor yang terlibat." },
      { heading: "Alur Utama", instruction: "Tulis langkah bernomor dari awal sampai tujuan tercapai." },
      { heading: "Kasus Tepi", instruction: "Daftar 3-5 kondisi gagal atau pengecualian dan penanganannya." },
    ],
    validate: () => null,
  },
  TECHNICAL_SPEC: {
    defaultTitle: "Spesifikasi Teknis",
    sections: [
      { heading: "Arsitektur", instruction: "Deskripsikan modul dan alur data utama." },
      { heading: "Skema Data", instruction: "Daftar entitas dan field pentingnya." },
      { heading: "API", instruction: "Daftar endpoint utama dengan metode dan tujuannya." },
      { heading: "Keamanan", instruction: "Tulis kontrol keamanan yang relevan." },
    ],
    validate: () => null,
  },
  TEST_PLAN: {
    defaultTitle: "Rencana Uji",
    sections: [
      { heading: "Strategi", instruction: "Jelaskan pendekatan pengujian per lapisan." },
      { heading: "Kasus Uji", instruction: "Daftar kasus uji bernomor dengan hasil yang diharapkan." },
      { heading: "Kriteria Lolos", instruction: "Tulis syarat kelulusan yang konkret." },
    ],
    validate: () => null,
  },
  TASKS: {
    defaultTitle: "Tugas & AGENTS",
    sections: [
      { heading: "Tugas", instruction: "Daftar tugas bernomor (T-1, T-2, …) dengan prioritas dan dependensi; rujuk ID FR dari PRD." },
      { heading: "Kriteria Penerimaan", instruction: "Untuk tiap tugas tulis kriteria penerimaan yang dapat diverifikasi." },
    ],
    validate: needsAcceptance,
  },
  AGENTS: {
    defaultTitle: "AGENTS",
    sections: [
      { heading: "Aturan Kerja", instruction: "Tulis aturan ringkas untuk agen koding: persetujuan file, pengujian, dan pelaporan." },
      { heading: "Batasan", instruction: "Daftar hal yang tidak boleh dilakukan agen tanpa persetujuan." },
    ],
    validate: () => null,
  },
};

export function buildSystemPrompt(): string {
  return [
    "Anda membantu menyusun dokumen perencanaan perangkat lunak dalam Bahasa Indonesia.",
    "Tulis Markdown saja, tanpa blok kode pembungkus dan tanpa basa-basi.",
    "Setiap bagian yang diminta tulis sebagai naskah mandiri yang konsisten dengan konteks proyek.",
    "Jangan mengeksekusi, mengubah, atau meminta perubahan file apa pun.",
  ].join("\n");
}

export function buildSectionPrompt(section: SectionSpec, context: string): string {
  return `Konteks proyek:\n${context}\n\nTulis bagian "${section.heading}" saja sebagai Markdown (tanpa judul ulang): ${section.instruction}`;
}

export function buildQuestionsPrompt(context: string): string {
  return [
    "Konteks proyek:",
    context,
    "",
    "Ajukan maksimal 8 pertanyaan klarifikasi bernomor yang paling penting untuk perencanaan.",
    'Jawab HANYA dengan JSON valid berbentuk {"questions": ["..."]}, tanpa teks lain.',
  ].join("\n");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[dipotong]`;
}
