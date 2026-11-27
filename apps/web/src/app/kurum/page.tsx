import type { Metadata } from "next";
import { InstitutionPanel } from "./panel";

export const metadata: Metadata = {
  title: "Kurum paneli | Güvenlik Haritası",
  description: "Güvenlik Haritası kurum bildirimleri ve önlem işlemleri.",
};

export default function InstitutionPage() {
  return <InstitutionPanel />;
}
