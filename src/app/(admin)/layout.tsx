import { Guard } from "@/components/shell/Guard";

/** Area del bibliotecario: pantallas 14 a 22. */
export default function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Guard rol="bibliotecario">{children}</Guard>;
}
