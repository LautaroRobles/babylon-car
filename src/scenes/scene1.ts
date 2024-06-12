import { Color3, Engine, FreeCamera, HemisphericLight, MeshBuilder, Scene, StandardMaterial, Texture, Vector3 } from "@babylonjs/core";

// Esta es la escena que viene de ejemplo
export function createScene (engine: Engine, canvas: HTMLCanvasElement): Scene {
    // this is the default code from the playground:

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new Scene(engine);

    // This creates and positions a free camera (non-mesh)
    var camera = new FreeCamera("camera1", new Vector3(0, 5, -10), scene);

    // This targets the camera to scene origin
    camera.setTarget(Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // Default intensity is 1. Let's dim the light a small amount
    light.intensity = 0.7;

    // Our built-in 'sphere' shape.
    var sphere = MeshBuilder.CreateSphere("sphere", { diameter: 2, segments: 32 }, scene);
    // Move the sphere upward 1/2 its height
    let startPos = 2;
    sphere.position.y = startPos;

    // Our built-in 'ground' shape.
    var ground = MeshBuilder.CreateGround("ground", { width: 6, height: 6 }, scene);
    var groundMaterial = new StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseColor = new Color3(0.5, 0.8, 0.5); // RGB for a greenish color
    ground.material = groundMaterial;
    groundMaterial.bumpTexture = new Texture("./normal.jpg", scene);
    //groundMaterial.bumpTexture.level = 0.125;    


    var redMaterial = new StandardMaterial("redMaterial", scene);
    redMaterial.diffuseColor = new Color3(1, 0, 0); // RGB for red
    sphere.material = redMaterial;

    var sphereVelocity = 0;
    var gravity = 0.009;
    var reboundLoss = 0.1;

    scene.registerBeforeRender(() => {
        sphereVelocity += gravity;
        let newY = sphere.position.y - sphereVelocity;
        sphere.position.y -= sphereVelocity
        if (newY < 1) {
            sphereVelocity = (reboundLoss - 1) * sphereVelocity;
            newY = 1;
        }
        sphere.position.y = newY;
        if (Math.abs(sphereVelocity) <= gravity && newY < 1 + gravity) {
            sphere.position.y = startPos++;
        }
    });

    return scene;
};