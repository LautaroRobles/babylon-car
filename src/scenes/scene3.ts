import { Color3, Engine, FollowCamera, FreeCamera, HavokPlugin, HemisphericLight, KeyboardEventTypes, MeshBuilder, PhysicsAggregate, PhysicsImpostor, PhysicsShapeType, Scene, StandardMaterial, Vector3 } from "@babylonjs/core";
import { GridMaterial } from '@babylonjs/materials';
import HavokPhysics from "@babylonjs/havok";
import Car from "../doohickeys/car/Car";
import Tire from "../doohickeys/car/Tire";

function generarOptions() {
    const tireMesh = MeshBuilder.CreateCylinder("tire", { height: 0.1, diameter: 1 })
    tireMesh.rotation = new Vector3(0, 0, Math.PI / 2)
    
    return {
        dimensions: {
            width: 1.7,
            height: 1.2,
            size: 4.6,
        },
        mass: 1154,
        acceleration: {
            topSpeedKmh: 200,
            engineStrenght: 10000,
            brakingStrength: 10,
            deaccelerationStrength: 1,
        },
        steering: {
            maxRotationAngle: 45,
        },
        suspension: {
            rayLength: 2,
            restDistance: 1,
            springStrength: 60000,
            springDamp: 4000,
        },
        tires: [
            new Tire({ position: new Vector3(-1, -0.4,  1.8), canThrust: false, canRotate: 1 , gripSpeed: 60, fastGrip: 5 , slowGrip: 15, mesh: tireMesh.clone("tire1") }),
            new Tire({ position: new Vector3( 1, -0.4,  1.8), canThrust: false, canRotate: 1 , gripSpeed: 60, fastGrip: 5 , slowGrip: 15, mesh: tireMesh.clone("tire2") }),
            new Tire({ position: new Vector3(-1, -0.4, -1.8), canThrust: true , canRotate: 0 , gripSpeed: 60, fastGrip: 50, slowGrip: 15, mesh: tireMesh.clone("tire3") }),
            new Tire({ position: new Vector3( 1, -0.4, -1.8), canThrust: true , canRotate: 0 , gripSpeed: 60, fastGrip: 50, slowGrip: 15, mesh: tireMesh.clone("tire4") }),
        ]
    }
}

// No es necesario crear las escenas de esta manera pero lo hago asi porque es lo mas facil
export async function createScene (engine: Engine): Promise<Scene> {

    // This creates a basic Babylon Scene object (non-mesh)
    const scene = new Scene(engine);

    // Fisicas con havok
    const havokInstance = await HavokPhysics();
    const hk = new HavokPlugin(true, havokInstance);
    scene.enablePhysics(new Vector3(0, -9.8, 0), hk);

    const physicsEngine = scene.getPhysicsEngine()!!

    // Un poco de luz para que se vea algo
    new HemisphericLight("light", new Vector3(0, 1, 0), scene);

    // Crear el auto
    let options = generarOptions()
    options.acceleration.engineStrenght = 15000
    options.acceleration.topSpeedKmh = 300

    const car1 = new Car("car1", scene, engine, physicsEngine, options)
    car1.carBody.disablePreStep = true
    car1.position = new Vector3(0, 20, 0)
    car1.carBody.disablePreStep = false

    const car2 = new Car("car2", scene, engine, physicsEngine, generarOptions())
    car2.carBody.disablePreStep = true
    car2.position = new Vector3(5, 20, 5)
    car2.carBody.disablePreStep = false

    const car3 = new Car("car3", scene, engine, physicsEngine, generarOptions())
    car3.carBody.disablePreStep = true
    car3.position = new Vector3(-5, 20, 0)
    car3.carBody.disablePreStep = false

    // This creates and positions a free camera (non-mesh)
    const camera = new FollowCamera("camera1", new Vector3(0, 5, 10), scene, car1.carMesh);
    camera.rotationOffset = 180

    // Crear el piso a partir de un heightmap de la carpeta /public
    let ground = MeshBuilder.CreateGroundFromHeightMap("ground", "heightmap.jpg", {
        width: 5000, 
        height: 5000,
        minHeight: 0,
        maxHeight: 100,
        subdivisions: 64,
        onReady: (groundMesh) => {
            // Cuando se termina de generar la mesh creamos el PhysicsBody y PhisicsShape
            new PhysicsAggregate(ground, PhysicsShapeType.MESH, { mass: 0, mesh: groundMesh }, scene);
        }
    })
    
    // Creamos un material de grid para el ground
    ground.material = new GridMaterial("ground_material")

    // Registrar inputs
    scene.onKeyboardObservable.add((kbInfo) => {
        switch (kbInfo.type) {
            case KeyboardEventTypes.KEYDOWN:
                switch (kbInfo.event.key) {
                    case "a":
                        car1.inputs.rotationAngleChange = -4
                        break;
                    case "d":
                        car1.inputs.rotationAngleChange = 4
                        break;
                    case "w":
                        car1.inputs.accelerationInput = 1
                        break;
                    case "s":
                        car1.inputs.accelerationInput = -1                                                         
                        break;
                }
                break;
            case KeyboardEventTypes.KEYUP:
                switch (kbInfo.event.key) {
                    case "a":
                        car1.inputs.rotationAngleChange = 0
                        break;
                    case "d":
                        car1.inputs.rotationAngleChange = 0
                        break;
                    case "w":
                        car1.inputs.accelerationInput = 0
                        break;
                    case "s":
                        car1.inputs.accelerationInput = 0                                                         
                        break;
                }
                break;
        }
    });

    car2.inputs.accelerationInput = 1
    car3.inputs.accelerationInput = 1
    car3.inputs.rotationAngleChange = 1

    // Actualizamos el auto antes de las fisicas
    scene.onBeforePhysicsObservable.add(() => {
        car1.update()
        car2.update()
        car3.update()
    })

    // Actualizamos el auto en cada fotograma
    scene.registerBeforeRender(() => {
    });

    return scene;
};
