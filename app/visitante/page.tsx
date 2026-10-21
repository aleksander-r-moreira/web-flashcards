import type { Metadata } from "next";
import { GuestApp } from "./guest-app";

export const metadata: Metadata = {
  title: "Testar sem conta · Estudos",
};

export default function GuestPage() {
  return <GuestApp />;
}
