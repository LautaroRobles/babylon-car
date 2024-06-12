import { Color3, Engine, FollowCamera, FreeCamera, HavokPlugin, HemisphericLight, MeshBuilder, PhysicsAggregate, PhysicsImpostor, PhysicsShapeType, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { GridMaterial } from '@babylonjs/materials';
import HavokPhysics from "@babylonjs/havok";
import Car from "../doohickeys/car";

// No es necesario crear las escenas de esta manera pero lo hago asi porque es lo mas facil
export async function createScene (engine: Engine): Promise<Scene> {

    // This creates a basic Babylon Scene object (non-mesh)
    var scene = new Scene(engine);

    // Fisicas con havok
    const havokInstance = await HavokPhysics();
    const hk = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.8, 0), hk);

    // Un poco de luz para que se vea algo
    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // Crear el auto
    let car = new Car(scene, engine, new Vector3(0, 10, 0))

    // This creates and positions a free camera (non-mesh)
    var camera = new FollowCamera("camera1", new Vector3(0, 5, 10), scene, car.car);
    camera.rotationOffset = 180

    // Crear el piso a partir de un heightmap de la carpeta /public
    let ground = MeshBuilder.CreateGroundFromHeightMap("ground", "heightmap.jpg", {
        width: 1000, 
        height: 1000,
        minHeight: 0,
        maxHeight: 10,
        subdivisions: 64,
        onReady: (groundMesh) => {
            // Cuando se termina de generar la mesh creamos el PhysicsBody y PhisicsShape
            new PhysicsAggregate(ground, PhysicsShapeType.MESH, { mass: 0, mesh: groundMesh }, scene);
        }
    })
    
    // Creamos un material de grid para el ground
    ground.material = new GridMaterial("ground_material")

    // Actualizamos el auto en cada fotograma
    scene.registerBeforeRender(() => {
        car.update()
    });

    return scene;
};
