import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import { Engine } from "@babylonjs/core";
// Aca se puede cambiar la escena que se importa
import { createScene } from "./scenes/scene3";

// Determina si en la escena se mostrara un menu de debug
const debug = import.meta.env.DEV

// Inicializamos Babylon
console.log(`Iniciando Juego`);
window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement
    const engine = new Engine(canvas)
    const scene = await createScene(engine) // Por ahora solamente tenemos una unica escena

    if (debug) {
        scene.debugLayer.show({ overlay: true });
    } else {
        scene.debugLayer.hide();
    }

    window.addEventListener('resize', () => {
        engine.resize()
    })

    engine.runRenderLoop(() => {
        scene.render()
    })

});