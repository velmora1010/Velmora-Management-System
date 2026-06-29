import type { Metadata } from "next";
import "../styles/globals.css";
import Sidebar from "../components/Sidebar";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "ST Courier Analysis",
  description: "Advanced Tracking and OCR Management for ST Courier",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <div className={styles.layout}>
          <Sidebar />
          <main className={styles.main}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
