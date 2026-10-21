import { contratoRepositorio } from "./contrato.js";
import { crearRepositorioEnMemoria } from "./memoria.js";

contratoRepositorio("memoria", async (hoy) => crearRepositorioEnMemoria(hoy));
