// File: STLViewer.jsx

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const STLViewer = ({ url, parentAnnotationState, setParentAnnotations, updateParentAnnotations }) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const meshRef = useRef(null);

  const [error, setError] = useState(null);

  // Annotations stored in React state
  const [annotations, setAnnotations] = useState([]);

  // Track whether this is a drag or a click
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mouseMoved, setMouseMoved] = useState(false);

  // Utility to project 3D coordinates to 2D (screen) coordinates
  const projectToScreen = (pos3D) => {
    if (!cameraRef.current || !rendererRef.current) return { x: -9999, y: -9999 };
    const width = rendererRef.current.domElement.clientWidth;
    const height = rendererRef.current.domElement.clientHeight;

    const vector = pos3D.clone();
    vector.project(cameraRef.current);

    const screenX = (vector.x * 0.5 + 0.5) * width;
    const screenY = (-vector.y * 0.5 + 0.5) * height;
    return { x: screenX, y: screenY };
  };

  // "Save" annotations by sending an event to the parent application
  const saveAnnotations = () => {
    setParentAnnotations(['hardcoded']);
    window.alert(setParentAnnotations);
    // setParentAnnotations(annotations);
  }

  // Handle text changes in the annotation list
  const handleTextChange = (id, newText) => {
    setAnnotations((prev) =>
      prev.map((anno) => (anno.id === id ? { ...anno, text: newText } : anno))
    );
  };

  // Handle delete
  const handleDeleteAnnotation = (id) => {
    setAnnotations((prev) => prev.filter((anno) => anno.id !== id));
  };

  useEffect(() => {
    const initScene = async () => {
      // Scene
      if (!sceneRef.current) {
        sceneRef.current = new THREE.Scene();
        sceneRef.current.add(new THREE.AmbientLight(0x404040));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1).normalize();
        sceneRef.current.add(directionalLight);
      }

      // Camera
      if (!cameraRef.current) {
        cameraRef.current = new THREE.PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
        );
        cameraRef.current.position.z = 10;
      }

      // Renderer
      if (!rendererRef.current && containerRef.current) {
        rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
        containerRef.current.appendChild(rendererRef.current.domElement);
      }

      // OrbitControls
      if (!controlsRef.current && rendererRef.current) {
        controlsRef.current = new OrbitControls(
          cameraRef.current,
          rendererRef.current.domElement
        );
        controlsRef.current.enableDamping = true;
        controlsRef.current.dampingFactor = 0.05;
      }

      // Load the STL
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load STL file');

        const arrayBuffer = await response.arrayBuffer();
        const loader = new STLLoader();
        const geometry = loader.parse(arrayBuffer);

        // Remove existing mesh if any
        if (meshRef.current) {
          sceneRef.current.remove(meshRef.current);
          meshRef.current.geometry.dispose();
          meshRef.current.material.dispose();
        }

        geometry.center(); // center the geometry

        // Create mesh
        meshRef.current = new THREE.Mesh(
          geometry,
          new THREE.MeshPhongMaterial({ color: 0x00ff00 })
        );
        sceneRef.current.add(meshRef.current);

        // Adjust camera based on bounding box
        geometry.computeBoundingBox();
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        cameraRef.current.position.set(0, 0, Math.max(...size.toArray()) * 2);

        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('STL loading error:', err);
      }
    };

    initScene();

    // Animation
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Handle resize
    const handleWindowResize = () => {
      if (rendererRef.current && cameraRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(window.innerWidth, window.innerHeight);
      }
    };
    window.addEventListener('resize', handleWindowResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleWindowResize);
      cancelAnimationFrame(animationFrameId);

      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
      if (containerRef.current && containerRef.current.firstChild) {
        containerRef.current.removeChild(containerRef.current.firstChild);
      }
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      meshRef.current = null;
    };
  }, [url]);

  // Pointer events to distinguish click vs. drag
  useEffect(() => {
    const onPointerDown = () => {
      setIsMouseDown(true);
      setMouseMoved(false);
    };

    const onPointerMove = () => {
      if (isMouseDown) {
        setMouseMoved(true);
      }
    };

    const onPointerUp = (event) => {
      setIsMouseDown(false);
      // If mouse didn't move, treat as a single click => place annotation
      if (!mouseMoved && rendererRef.current && cameraRef.current && meshRef.current) {
        const rect = rendererRef.current.domElement.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera({ x, y }, cameraRef.current);
        const intersects = raycaster.intersectObject(meshRef.current);

        if (intersects.length > 0) {
          const point = intersects[0].point;
          const text = window.prompt('Enter annotation text:', '');
          if (text) {
            // Label = next annotation number (1-based)
            const label = annotations.length + 1;
            setAnnotations((prev) => [
              ...prev,
              {
                id: Date.now(),
                label,
                text,
                position: point.clone(),
              },
            ]);
          }
        }
      }
    };

    if (rendererRef.current) {
      const domEl = rendererRef.current.domElement;
      domEl.addEventListener('pointerdown', onPointerDown);
      domEl.addEventListener('pointermove', onPointerMove);
      domEl.addEventListener('pointerup', onPointerUp);

      return () => {
        domEl.removeEventListener('pointerdown', onPointerDown);
        domEl.removeEventListener('pointermove', onPointerMove);
        domEl.removeEventListener('pointerup', onPointerUp);
      };
    }
  }, [isMouseDown, mouseMoved, annotations]);

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      {/* Three.js container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'absolute' }} />

      {/* Numeric overlays on the 3D object */}
      {annotations.map((anno) => {
        const screenPos = projectToScreen(anno.position);
        return (
          <div
            key={anno.id}
            style={{
              position: 'absolute',
              left: screenPos.x,
              top: screenPos.y,
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              background: 'rgba(255, 255, 255, 0.8)',
              padding: '2px 5px',
              borderRadius: '3px',
              border: '1px solid #333',
              fontSize: '12px',
            }}
          >
            {anno.label}
          </div>
        );
      })}

      {/* Annotation List outside the canvas */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          width: '300px',
          padding: '10px',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          border: '1px solid #999',
          borderRadius: '4px',
          maxHeight: '90%',
          overflowY: 'auto',
        }}
      >
        <h3>Annotations</h3>
        {annotations.map((anno) => (
          <div key={anno.id} style={{ marginBottom: '8px' }}>
            <div style={{ marginBottom: '3px' }}>
              <strong>{anno.label}</strong>
            </div>
            <input
              type="text"
              value={anno.text}
              onChange={(e) => handleTextChange(anno.id, e.target.value)}
              style={{ width: '100%', marginBottom: '4px' }}
            />
            <button onClick={() => handleDeleteAnnotation(anno.id)}>Delete</button>
          </div>
        ))}
        <button onClick={() => saveAnnotations()}>Save Annotations</button>
      </div>
    </div>
  );
};

export default STLViewer;
