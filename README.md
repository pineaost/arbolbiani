# Árbol Familiar

Aplicación web de árbol genealógico interactivo. Ver `Especificación Funcional v1.0`
para la visión completa del proyecto — este README solo cubre la puesta en marcha técnica.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Supabase (Postgres + Auth + Storage) · Vercel

## Estructura

```
app/                  rutas (App Router)
  (app)/                layout autenticado con navegación compartida
    arbol/               pantalla principal — mapa navegable
    archivo/             administración: alta/baja/edición
    bitacora/            cuaderno de investigación
  login/                acceso sin navegación de la aplicación
components/nav/        sidebar (desktop) y barra inferior (mobile)
lib/
  supabase/            clientes de Supabase (browser y server)
  types.ts             tipos que reflejan el modelo de datos
supabase/migrations/    esquema SQL versionado
```

La interfaz no contiene lógica de negocio: eso vive en `/lib` para que el
modelo de datos pueda evolucionar sin reestructurar la aplicación.

## Puesta en marcha

1. **Instalar dependencias**

   ```bash
   npm install
   ```

2. **Crear el proyecto en Supabase** (si todavía no existe) en
   [supabase.com](https://supabase.com).

3. **Aplicar el esquema.** Con la [Supabase CLI](https://supabase.com/docs/guides/cli)
   instalada y logueada:

   ```bash
   supabase link --project-ref <tu-project-ref>
   supabase db push
   ```

   Esto corre en orden los archivos de `supabase/migrations/`. También se
   pueden pegar manualmente en el SQL Editor del panel de Supabase, en orden
   numérico.

4. **Variables de entorno.** Copiar `.env.local.example` a `.env.local` y
   completar con la URL y la anon key del proyecto (Project Settings → API).

5. **Correr en desarrollo**

   ```bash
   npm run dev
   ```

   La app queda disponible en `http://localhost:3000` y redirige a `/arbol`.

## Estado actual

- ✅ Etapa 0 — Visión del proyecto
- ✅ Etapa 1 — Prototipo funcional del Árbol (validado conceptualmente)
- 🚧 Etapa 2 — Este scaffold: esquema de datos en Supabase + estructura del
  proyecto. Las tres pantallas existen como placeholders navegables.
- ⏳ Etapa 3 — Archivo Familiar (CRUD)
- ⏳ Etapa 4 — Bitácora
- ⏳ Etapa 5 — Sistema visual definitivo
- ⏳ Etapa 6 — Integración, refinamiento y producción

## Deploy

Pensado para Vercel: conectar el repositorio, configurar las mismas
variables de entorno que en `.env.local`, y cada push a `main` despliega.
