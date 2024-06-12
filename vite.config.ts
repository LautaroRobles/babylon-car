import { defineConfig, loadEnv } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')

    // HACK: Vite usa la carpeta "node_modules/.vite/deps/" cuando crear un servidor de desarrollo (npm run dev)
    // PERO no esta incluyendo en esa carpeta el archivo HavokPhysics.wasm que necesita babylon para ejecutar fisicas.
    // Esto parece que es un problema con vite que no arreglaron https://github.com/vitejs/vite/issues/8427
    //
    // Entonces implemento este HACK para que copie el archivo necesario solo cuando estoy en modo development
    return env.NODE_ENV == "development" ? {
        plugins: [
            viteStaticCopy({
                targets: [
                    {
                        src: 'node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm',
                        dest: 'node_modules/.vite/deps/'
                    }
                ]
            })
        ]
    } : {}
})