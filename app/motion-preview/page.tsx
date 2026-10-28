import { notFound } from "next/navigation";
import MotionPreviewClient from "../../components/MotionPreviewClient";

export const dynamic = "force-dynamic";

export default function MotionPreviewPage() {
  if (process.env.HOOPCHECK_MOTION_TEST_MODE !== "true") notFound();
  return <MotionPreviewClient />;
}
