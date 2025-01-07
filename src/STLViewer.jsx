// File: STLViewer.jsx

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const STLViewer = ({ url }) => {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const meshRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize the scene, camera, renderer, controls
    const initScene = async () => {
      // Create scene if needed
      if (!sceneRef.current) {
        sceneRef.current = new THREE.Scene();
        sceneRef.current.add(new THREE.AmbientLight(0x404040));
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(1, 1, 1).normalize();
        sceneRef.current.add(directionalLight);
      }

      // Create camera if needed
      if (!cameraRef.current) {
        cameraRef.current = new THREE.PerspectiveCamera(
          75,
          window.innerWidth / window.innerHeight,
          0.1,
          1000
        );
        cameraRef.current.position.z = 10;
      }

      // Create renderer if needed
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

      try {
        // Fetch and parse STL
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load STL file');

        const arrayBuffer = await response.arrayBuffer();
        const loader = new STLLoader();
        const geometry = loader.parse(arrayBuffer);

        // If we already have a mesh, remove it
        if (meshRef.current) {
          sceneRef.current.remove(meshRef.current);
          meshRef.current.geometry.dispose();
          meshRef.current.material.dispose();
        }

        // Center the geometry
        geometry.center();

        // Create mesh
        meshRef.current = new THREE.Mesh(
          geometry,
          new THREE.MeshPhongMaterial({ color: 0x00ff00 })
        );

        // Add mesh to scene
        sceneRef.current.add(meshRef.current);

        // Compute bounding box for camera distance
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

    // Animation loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (controlsRef.current) controlsRef.current.update();
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Handle window resize
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

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-100">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-screen" />;
};

export default STLViewer;
