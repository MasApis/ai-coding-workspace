export interface DesignSectionSpec {
  heading: string;
  instruction: string;
}

export const DESIGN_SECTIONS: DesignSectionSpec[] = [
  { heading: "Brief Desain", instruction: "Tulis audiens, tujuan, gaya visual, dan batasan desain dari PRD." },
  { heading: "Peta Situs", instruction: "Daftar halaman/layar utama sebagai daftar berpoin dengan tujuan tiap layar." },
  { heading: "Layar", instruction: "Untuk tiap layar: nama, konten utama, dan aksi primer." },
  { heading: "Komponen", instruction: "Daftar komponen UI yang dipakai ulang beserta statenya (loading/empty/error)." },
  { heading: "Token Desain", instruction: "Daftar token warna, tipografi, radius, dan spasi sebagai daftar." },
];

export function buildDesignSystemPrompt(): string {
  return [
    "Anda desainer UI yang membantu dalam Bahasa Indonesia.",
    "Tulis Markdown saja, tanpa blok kode pembungkus dan tanpa basa-basi.",
    "Setiap bagian harus merujuk kebutuhan PRD yang disetujui. Jangan mengarang fitur di luar PRD.",
    "Jangan mengeksekusi, mengubah, atau meminta perubahan file apa pun.",
  ].join("\n");
}

export function buildDesignSectionPrompt(section: DesignSectionSpec, context: string): string {
  return `Konteks PRD yang disetujui:\n${context}\n\nTulis bagian "${section.heading}" saja sebagai Markdown (tanpa judul ulang): ${section.instruction}`;
}

export function validateDesignSpec(markdown: string): string | null {
  const required = ["Brief Desain", "Peta Situs", "Layar", "Komponen", "Token Desain"];
  for (const heading of required) {
    if (!markdown.toLowerCase().includes(`## ${heading.toLowerCase()}`)) {
      return `bagian hilang: ${heading}`;
    }
  }
  return null;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[dipotong]`;
}
