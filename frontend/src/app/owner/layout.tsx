import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Owner Dashboard - RentSplit",
  description: "Property management dashboard for owners",
};

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
