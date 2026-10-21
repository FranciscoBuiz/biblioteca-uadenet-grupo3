import { Guard } from "@/components/shell/Guard";

/** Area del estudiante: pantallas 02 a 13. */
export default function LayoutEstudiante({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Guard rol="estudiante">{children}</Guard>;
}
