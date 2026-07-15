/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TimelineFrame } from '../store/types';

interface Match3DCanvasProps {
  currentFrame: TimelineFrame;
  playbackProgress: number; // 0 to 1 between frames for smooth transition interpolation
  nextFrame?: TimelineFrame;
}

export default function Match3DCanvas({ currentFrame, playbackProgress, nextFrame }: Match3DCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const scorerLabelRef = useRef<HTMLDivElement>(null);
  const scorerDotRef = useRef<HTMLSpanElement>(null);
  const scorerTextRef = useRef<HTMLSpanElement>(null);

  // Cache the latest props inside a mutable ref so the Three.js render loop can read them 
  // without re-running the main useEffect setup (which was destroying and recreating WebGL context).
  const propsRef = useRef({ currentFrame, playbackProgress, nextFrame });

  useEffect(() => {
    propsRef.current = { currentFrame, playbackProgress, nextFrame };
  }, [currentFrame, playbackProgress, nextFrame]);

  useEffect(() => {
    if (!mountRef.current) return;

    // Clear any previous child nodes to guarantee exactly one canvas is rendered
    mountRef.current.innerHTML = '';

    // Cleanup variables for 3D goalposts
    let goalUprightGeo: THREE.CylinderGeometry | null = null;
    let goalCrossbarGeo: THREE.CylinderGeometry | null = null;
    let goalNetGeo: THREE.BufferGeometry | null = null;
    let goalPostMat: THREE.MeshBasicMaterial | null = null;
    let goalNetMat: THREE.LineBasicMaterial | null = null;

    // Dimensions
    const width = mountRef.current.clientWidth || 600;
    const height = mountRef.current.clientHeight || 500;

    // Create scene with dark charcoal neo-brutalist blueprint look
    const scene = new THREE.Scene();

    // Fog to fade grid into the dark background at the edges
    scene.fog = new THREE.FogExp2(0x121212, 0.045);

    // Camera setup - slanted isometric tactical view
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    
    // Renderer - Alpha FALSE with explicit background color
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x121212, 1.0); // Perfect dark charcoal background
    mountRef.current.appendChild(renderer.domElement);

    // Dimensions of our football field plane
    const fieldWidth = 18;
    const fieldLength = 12;

    // Number of segments in particle grid (dense grid for waves like the video)
    const cols = 90;
    const rows = 60;
    const count = cols * rows;

    // Setup Single Geometry for solid, wireframe, and point layers
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    // Fill initial positions
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);

      // Map segments to 3D space coordinates (centered around origin)
      const x = (col / (cols - 1) - 0.5) * fieldWidth;
      const z = (row / (rows - 1) - 0.5) * fieldLength;
      const y = 0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      // Initial color assignment
      colors[i * 3] = 0.2;
      colors[i * 3 + 1] = 0.6;
      colors[i * 3 + 2] = 0.9;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Create Indices for triangles to enable solid Mesh and Wireframe representation
    const indices = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const a = r * cols + c;
        const b = r * cols + (c + 1);
        const c_idx = (r + 1) * cols + c;
        const d = (r + 1) * cols + (c + 1);

        // First triangle
        indices.push(a, c_idx, b);
        // Second triangle
        indices.push(b, c_idx, d);
      }
    }
    geometry.setIndex(indices);

    // Custom circle texture for glowing intersections
    const createCircleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 32;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 32, 32);
      }
      return new THREE.CanvasTexture(canvas);
    };

    // LAYER 1: Solid translucent colored fabric (high opacity for solid vibrant blueprint feel)
    const meshMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92, // High opacity to make team colors extremely visible on the pitch, not faded
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const waveMesh = new THREE.Mesh(geometry, meshMaterial);
    waveMesh.frustumCulled = false;
    scene.add(waveMesh);

    // LAYER 2: Wireframe grid lines (gives clean blueprint grid look in high contrast)
    const wireMaterial = new THREE.MeshBasicMaterial({
      color: 0xF5F5F5, // Off-white grid lines
      transparent: true,
      opacity: 0.12, // Muted but sharp architectural wireframe overlay
      wireframe: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const waveWireframe = new THREE.Mesh(geometry, wireMaterial);
    waveWireframe.frustumCulled = false;
    scene.add(waveWireframe);

    // LAYER 3: Discrete grid nodes
    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.12, 
      color: 0xF5F5F5, // Off-white point intersections
      transparent: true,
      opacity: 0.35,
      map: createCircleTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const wavePoints = new THREE.Points(geometry, pointsMaterial);
    wavePoints.frustumCulled = false;
    scene.add(wavePoints);

    // Dynamic wave height calculation helper
    const getWaveHeightAt = (
      x: number,
      z: number,
      time: number,
      smoothTerrCenter: number,
      smoothLeftHeight: number,
      smoothRightHeight: number,
      goalSpikeFactor: number,
      scoringTeam: string,
      currentBallX: number,
      currentBallZ: number,
      smoothWaveFrequency: number,
      smoothWaveAngle: number,
      freshnessFactor: number,
      shotPulse: number,
      cornerPulse: number,
      foulPulse: number,
      cardPulse: number,
      homePressure: number,
      awayPressure: number,
      momentumShift: number,
      matchFlowMultiplier: number,
    ) => {
      // 1. Base idle stadium ripples — gentle, fixed-speed like match-simulation-2
      let height = Math.sin(x * 0.4 + time * 1.6) * Math.cos(z * 0.4 + time * 1.3) * 0.08 * matchFlowMultiplier;

      // 2. Territory peaks (modeled via smooth Gaussian bell curves)
      const argCenter = -4.5 + smoothTerrCenter * 1.5;
      const argSigma = 3.8;
      const argGaussian = Math.exp(-Math.pow(x - argCenter, 2) / (2 * Math.pow(argSigma, 2))) * Math.exp(-Math.pow(z, 2) / (2 * Math.pow(3.6, 2)));
      height += smoothLeftHeight * 2.6 * argGaussian * (0.70 + Math.sin(time * 4.5 + x * 0.5) * 0.30);

      const egyCenter = 4.5 + smoothTerrCenter * 1.5;
      const egySigma = 3.8;
      const egyGaussian = Math.exp(-Math.pow(x - egyCenter, 2) / (2 * Math.pow(egySigma, 2))) * Math.exp(-Math.pow(z, 2) / (2 * Math.pow(3.6, 2)));
      height += smoothRightHeight * 2.6 * egyGaussian * (0.70 + Math.sin(time * 4.5 - x * 0.5) * 0.30);

      // 3. Active clash vibration — conservative formula from match-simulation-2
      const clashIntensity = Math.min(smoothLeftHeight, smoothRightHeight) + (smoothLeftHeight + smoothRightHeight) * 0.15;
      if (clashIntensity > 0.1) {
        const clashRipple = Math.sin(x * 1.8 + time * 6.0) * Math.cos(z * 1.8 + time * 5.0) * 0.08 * clashIntensity;
        height += clashRipple;
      }

      // 4. Glowing ball interactive ripple — intensity modulated by freshness
      const distToBallSq = Math.pow(x - currentBallX, 2) + Math.pow(z - currentBallZ, 2);
      const ballRippleBase = Math.exp(-distToBallSq / 1.8) * 0.60 * (1.0 + Math.sin(time * 11.0 - distToBallSq * 3.5) * 0.35);
      const ballRipple = ballRippleBase * (0.5 + freshnessFactor * 0.5);
      height += ballRipple;

      // 5. Goal spike
      if (goalSpikeFactor > 0) {
        const goalX = scoringTeam === 'away' ? -9.0 : 9.0;
        const distToGoalSq = Math.pow(x - goalX, 2) + Math.pow(z, 2);
        const goalSpike = Math.exp(-distToGoalSq / 1.3) * 5.0 * goalSpikeFactor;
        height += goalSpike;
      }

      // 6. Shot pulse — brief expanding ring from ball position on shots
      if (shotPulse > 0.01) {
        const shotDist = Math.sqrt(distToBallSq);
        const shotRing = Math.sin(shotDist * 5.0 - time * 15.0) * shotPulse * 1.2 * Math.exp(-shotDist * 0.25);
        height += shotRing;
      }

      // 7. Corner ripple — pulsing ring at the nearest corner flag
      if (cornerPulse > 0.01) {
        const cornerPositions = [
          { cx: -9.0, cz: -6.0 }, { cx: -9.0, cz: 6.0 },
          { cx: 9.0, cz: -6.0 }, { cx: 9.0, cz: 6.0 },
        ];
        let nearestCornerDist = 999;
        for (const cp of cornerPositions) {
          const d = Math.sqrt(Math.pow(x - cp.cx, 2) + Math.pow(z - cp.cz, 2));
          if (d < nearestCornerDist) nearestCornerDist = d;
        }
        const cornerRipple = Math.sin(nearestCornerDist * 4.0 - time * 10.0) * cornerPulse * 0.6 * Math.exp(-nearestCornerDist * 0.15);
        height += cornerRipple;
      }

      // 8. Foul pulse — localized disturbance at ball position
      if (foulPulse > 0.01) {
        const foulRipple = Math.exp(-distToBallSq / 2.5) * foulPulse * 0.8 * Math.sin(time * 12.0 + distToBallSq * 5.0);
        height += foulRipple;
      }

      // 9. Card flash — vertical spike in the defensive zone
      if (cardPulse > 0.01) {
        const cardZone = scoringTeam === 'home' ? 6.0 : -6.0;
        const cardDist = Math.abs(x - cardZone);
        if (cardDist < 4.0) {
          const cardSpike = (1.0 - cardDist / 4.0) * cardPulse * 1.5 * Math.exp(-Math.pow(z, 2) / 8.0);
          height += cardSpike;
        }
      }

      // 10. Solana Tip Fan Shockwaves
      activeShockwaves.forEach(sw => {
        const distSq = Math.pow(x - sw.x, 2) + Math.pow(z - sw.z, 2);
        const dist = Math.sqrt(distSq);
        const progress = sw.age / sw.maxAge;
        const waveRadius = progress * 11.0;
        const width = 1.6;
        const distFromFront = Math.abs(dist - waveRadius);
        if (distFromFront < width) {
          const factor = 1.0 - (distFromFront / width);
          const ripple = Math.sin(dist * 7.0 - sw.age * 20.0) * sw.intensity * factor * (1.0 - progress) * 1.5;
          height += ripple;
        }
      });

      // 11. Pressure waves — pulsing waves in the dominant team's half
      if (homePressure > 0.3) {
        const pressAmp = (homePressure - 0.3) * 0.6;
        const pressWave = Math.sin(x * 0.8 + time * 3.5) * Math.cos(z * 0.6 + time * 2.8) * pressAmp;
        const homeHalfFade = Math.max(0, 1 - Math.abs(x + 3) / 5);
        height += pressWave * homeHalfFade;
      }
      if (awayPressure > 0.3) {
        const pressAmp = (awayPressure - 0.3) * 0.6;
        const pressWave = Math.sin(x * 0.8 - time * 3.5) * Math.cos(z * 0.6 - time * 2.8) * pressAmp;
        const awayHalfFade = Math.max(0, 1 - Math.abs(x - 3) / 5);
        height += pressWave * awayHalfFade;
      }

      // 12. Momentum surge — ripple propagating from ball when momentum shifts
      if (momentumShift > 0.3) {
        const surgeAmp = (momentumShift - 0.3) * 1.2;
        const surgeWave = Math.sin(distToBallSq * 2.0 - time * 8.0) * surgeAmp * Math.exp(-Math.sqrt(distToBallSq) * 0.2);
        height += surgeWave;
      }

      return height;
    };

    // Helper to subdivide straight line segments so they can drape beautifully over wave fabric
    const getSubdividedPoints = (p1: THREE.Vector3, p2: THREE.Vector3, segmentLength = 0.25) => {
      const pts: THREE.Vector3[] = [];
      const distance = p1.distanceTo(p2);
      const numSegments = Math.max(1, Math.ceil(distance / segmentLength));
      for (let i = 0; i <= numSegments; i++) {
        const t = i / numSegments;
        pts.push(new THREE.Vector3().lerpVectors(p1, p2, t));
      }
      return pts;
    };

    // Build list of high-fidelity field markings (will be projected to follow wave height dynamically)
    const markingsGroup = new THREE.Group();
    const lineMaterials = new THREE.LineBasicMaterial({
      color: 0xF5F5F5, // Clean, crisp off-white markings
      transparent: true,
      opacity: 0.60,
      blending: THREE.NormalBlending,
      linewidth: 2.5,
    });

    const createLineFromPoints = (pts: THREE.Vector3[]) => {
      const group = new THREE.Group();
      
      // Draw 5 parallel line copies with minor offsets to simulate visual line thickness 
      // in modern WebGL contexts, creating a beautifully rich, bright neon trace.
      const offsets = [
        { dx: 0, dz: 0 },
        { dx: -0.012, dz: -0.012 },
        { dx: 0.012, dz: 0.012 },
        { dx: -0.012, dz: 0.012 },
        { dx: 0.012, dz: -0.012 },
      ];

      offsets.forEach(offset => {
        const offsetPts = pts.map(p => new THREE.Vector3(p.x + offset.dx, p.y, p.z + offset.dz));
        const geo = new THREE.BufferGeometry().setFromPoints(offsetPts);
        const line = new THREE.Line(geo, lineMaterials);
        line.frustumCulled = false;
        group.add(line);
        fieldLines.push(line);
      });

      return group;
    };

    // Define field marking segments
    const fieldLines: THREE.Line[] = [];

    const halfWidth = fieldWidth / 2;
    const halfLength = fieldLength / 2;

    // Proportional dimensions for high-fidelity football markings
    const box18Depth = 2.8;
    const box18Width = 7.2;
    const box6Depth = 0.95;
    const box6Width = 3.2;
    const penSpotDist = 1.9;
    const penArcRadius = 1.65;

    // 1. Outer boundaries (Touchlines and Goal lines)
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth, 0, -halfLength), new THREE.Vector3(halfWidth, 0, -halfLength))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth, 0, -halfLength), new THREE.Vector3(halfWidth, 0, halfLength))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth, 0, halfLength), new THREE.Vector3(-halfWidth, 0, halfLength))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth, 0, halfLength), new THREE.Vector3(-halfWidth, 0, -halfLength))));

    // 2. Halfway line
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(0, 0, -halfLength), new THREE.Vector3(0, 0, halfLength))));

    // 3. Center Circle
    const centerCirclePoints = [];
    const radius = 2.2;
    for (let theta = 0; theta <= Math.PI * 2 + 0.05; theta += 0.05) {
      centerCirclePoints.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
    }
    markingsGroup.add(createLineFromPoints(centerCirclePoints));

    // Center Spot
    const centerSpotPoints = [];
    for (let theta = 0; theta <= Math.PI * 2 + 0.1; theta += 0.2) {
      centerSpotPoints.push(new THREE.Vector3(Math.cos(theta) * 0.1, 0, Math.sin(theta) * 0.1));
    }
    markingsGroup.add(createLineFromPoints(centerSpotPoints));

    // 4. Left Side Markings
    // 18-yard box (Penalty Area)
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth, 0, -box18Width/2), new THREE.Vector3(-halfWidth + box18Depth, 0, -box18Width/2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth + box18Depth, 0, -box18Width/2), new THREE.Vector3(-halfWidth + box18Depth, 0, box18Width/2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth + box18Depth, 0, box18Width/2), new THREE.Vector3(-halfWidth, 0, box18Width/2))));

    // 6-yard box (Goal Area)
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth, 0, -box6Width/2), new THREE.Vector3(-halfWidth + box6Depth, 0, -box6Width/2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth + box6Depth, 0, -box6Width/2), new THREE.Vector3(-halfWidth + box6Depth, 0, box6Width/2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth + box6Depth, 0, box6Width/2), new THREE.Vector3(-halfWidth, 0, box6Width/2))));

    // Left Penalty Spot
    const leftSpotX = -halfWidth + penSpotDist;
    const leftSpotPoints = [];
    for (let theta = 0; theta <= Math.PI * 2 + 0.1; theta += 0.2) {
      leftSpotPoints.push(new THREE.Vector3(leftSpotX + Math.cos(theta) * 0.08, 0, Math.sin(theta) * 0.08));
    }
    markingsGroup.add(createLineFromPoints(leftSpotPoints));

    // Left Penalty Arc (the D)
    const leftArcPoints = [];
    for (let theta = -1.0; theta <= 1.0; theta += 0.08) {
      leftArcPoints.push(new THREE.Vector3(leftSpotX + Math.cos(theta) * penArcRadius, 0, Math.sin(theta) * penArcRadius));
    }
    markingsGroup.add(createLineFromPoints(leftArcPoints));

    // 5. Right Side Markings
    // 18-yard box (Penalty Area)
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth, 0, -box18Width/2), new THREE.Vector3(halfWidth - box18Depth, 0, -box18Width/2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth - box18Depth, 0, -box18Width/2), new THREE.Vector3(halfWidth - box18Depth, 0, box18Width/2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth - box18Depth, 0, box18Width/2), new THREE.Vector3(halfWidth, 0, box18Width/2))));

    // 6-yard box (Goal Area)
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth, 0, -box6Width/2), new THREE.Vector3(halfWidth - box6Depth, 0, -box6Width/2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth - box6Depth, 0, -box6Width/2), new THREE.Vector3(halfWidth - box6Depth, 0, box6Width/2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth - box6Depth, 0, box6Width/2), new THREE.Vector3(halfWidth, 0, box6Width/2))));

    // Right Penalty Spot
    const rightSpotX = halfWidth - penSpotDist;
    const rightSpotPoints = [];
    for (let theta = 0; theta <= Math.PI * 2 + 0.1; theta += 0.2) {
      rightSpotPoints.push(new THREE.Vector3(rightSpotX + Math.cos(theta) * 0.08, 0, Math.sin(theta) * 0.08));
    }
    markingsGroup.add(createLineFromPoints(rightSpotPoints));

    // Right Penalty Arc (the D)
    const rightArcPoints = [];
    for (let theta = Math.PI - 1.0; theta <= Math.PI + 1.0; theta += 0.08) {
      rightArcPoints.push(new THREE.Vector3(rightSpotX + Math.cos(theta) * penArcRadius, 0, Math.sin(theta) * penArcRadius));
    }
    markingsGroup.add(createLineFromPoints(rightArcPoints));

    // 6. Left Goal Net Outline
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth, 0, -1.2), new THREE.Vector3(-halfWidth - 0.4, 0, -1.2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth - 0.4, 0, -1.2), new THREE.Vector3(-halfWidth - 0.4, 0, 1.2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(-halfWidth - 0.4, 0, 1.2), new THREE.Vector3(-halfWidth, 0, 1.2))));

    // 7. Right Goal Net Outline
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth, 0, -1.2), new THREE.Vector3(halfWidth + 0.4, 0, -1.2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth + 0.4, 0, -1.2), new THREE.Vector3(halfWidth + 0.4, 0, 1.2))));
    markingsGroup.add(createLineFromPoints(getSubdividedPoints(new THREE.Vector3(halfWidth + 0.4, 0, 1.2), new THREE.Vector3(halfWidth, 0, 1.2))));

    // 8. Corner Kick Arcs (Quarter-circles at all 4 corners of the field)
    const cornerArcRadius = 0.35;
    
    // Bottom-Left corner (-halfWidth, -halfLength)
    const clbPoints = [];
    for (let theta = 0; theta <= Math.PI / 2 + 0.05; theta += 0.08) {
      clbPoints.push(new THREE.Vector3(-halfWidth + Math.cos(theta) * cornerArcRadius, 0, -halfLength + Math.sin(theta) * cornerArcRadius));
    }
    markingsGroup.add(createLineFromPoints(clbPoints));

    // Top-Left corner (-halfWidth, halfLength)
    const cltPoints = [];
    for (let theta = 0; theta <= Math.PI / 2 + 0.05; theta += 0.08) {
      cltPoints.push(new THREE.Vector3(-halfWidth + Math.cos(theta) * cornerArcRadius, 0, halfLength - Math.sin(theta) * cornerArcRadius));
    }
    markingsGroup.add(createLineFromPoints(cltPoints));

    // Bottom-Right corner (halfWidth, -halfLength)
    const crbPoints = [];
    for (let theta = 0; theta <= Math.PI / 2 + 0.05; theta += 0.08) {
      crbPoints.push(new THREE.Vector3(halfWidth - Math.cos(theta) * cornerArcRadius, 0, -halfLength + Math.sin(theta) * cornerArcRadius));
    }
    markingsGroup.add(createLineFromPoints(crbPoints));

    // Top-Right corner (halfWidth, halfLength)
    const crtPoints = [];
    for (let theta = 0; theta <= Math.PI / 2 + 0.05; theta += 0.08) {
      crtPoints.push(new THREE.Vector3(halfWidth - Math.cos(theta) * cornerArcRadius, 0, halfLength - Math.sin(theta) * cornerArcRadius));
    }
    markingsGroup.add(createLineFromPoints(crtPoints));

    scene.add(markingsGroup);

    // High-Contrast Tactical Ball Mesh
    const ballGroup = new THREE.Group();
    const ballGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const ballMat = new THREE.MeshBasicMaterial({
      color: 0xff6f59, // Modern high-contrast coral/peach ball
      transparent: true,
      opacity: 1.0,
    });
    const ballMesh = new THREE.Mesh(ballGeo, ballMat);
    ballGroup.add(ballMesh);

    // Dynamic drop-indicator vector below the ball (high-contrast active laser line)
    const beamGeo = new THREE.CylinderGeometry(0.012, 0.12, 2.0, 16, 1, true);
    beamGeo.translate(0, -1.0, 0); // extend downwards
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xFCD34D, // Active amber vector line
      transparent: true,
      opacity: 0.30,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    const ballBeam = new THREE.Mesh(beamGeo, beamMat);
    ballGroup.add(ballBeam);

    scene.add(ballGroup);

    // Pulsing horizontal ring around the goal spike apex
    const ringGeo = new THREE.RingGeometry(0.2, 0.28, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x111111,
      transparent: true,
      opacity: 0.0,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beaconRing = new THREE.Mesh(ringGeo, ringMat);
    beaconRing.position.y = 0.04;
    scene.add(beaconRing);

    // Create Goalposts Mesh Helper
    const createGoalMesh = () => {
      const group = new THREE.Group();
      
      goalPostMat = new THREE.MeshBasicMaterial({
        color: 0xF5F5F5, // Crisp off-white poles
        transparent: true,
        opacity: 1.0,
        blending: THREE.NormalBlending,
      });

      // Left upright post
      goalUprightGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.9, 8);
      goalUprightGeo.translate(0, 0.45, 0); // anchor bottom at origin
      
      const leftPost = new THREE.Mesh(goalUprightGeo, goalPostMat);
      leftPost.position.set(0, 0, -1.2);
      group.add(leftPost);

      // Right upright post
      const rightPost = new THREE.Mesh(goalUprightGeo, goalPostMat);
      rightPost.position.set(0, 0, 1.2);
      group.add(rightPost);

      // Crossbar
      goalCrossbarGeo = new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8);
      goalCrossbarGeo.rotateX(Math.PI / 2); // align along Z axis
      
      const crossbar = new THREE.Mesh(goalCrossbarGeo, goalPostMat);
      crossbar.position.set(0, 0.9, 0);
      group.add(crossbar);

      // Back net support lines (fine draft wires)
      goalNetMat = new THREE.LineBasicMaterial({
        color: 0x888888,
        transparent: true,
        opacity: 0.40,
        blending: THREE.NormalBlending,
      });

      const netPts1 = [
        new THREE.Vector3(0, 0.9, -1.2),
        new THREE.Vector3(-0.4, 0, -1.2),
        new THREE.Vector3(-0.4, 0, 1.2),
        new THREE.Vector3(0, 0.9, 1.2)
      ];
      goalNetGeo = new THREE.BufferGeometry().setFromPoints(netPts1);
      const netFrame = new THREE.Line(goalNetGeo, goalNetMat);
      group.add(netFrame);

      return group;
    };

    const leftGoal = createGoalMesh();
    leftGoal.position.x = -halfWidth;
    scene.add(leftGoal);

    const rightGoal = createGoalMesh();
    // Rotate so net supports point outwards (positive X direction)
    rightGoal.scale.x = -1; 
    rightGoal.position.x = halfWidth;
    scene.add(rightGoal);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(5, 15, 5);
    scene.add(dirLight);

    // Interactive drag camera rotation states
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let rotationY = -0.4; // Slightly slanted isometric angle
    let rotationX = 0.55; // Slightly slanted height perspective

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      rotationY += deltaX * 0.005;
      rotationX = Math.max(0.15, Math.min(1.2, rotationX + deltaY * 0.005));

      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - previousMousePosition.x;
      const deltaY = e.touches[0].clientY - previousMousePosition.y;

      rotationY += deltaX * 0.005;
      rotationX = Math.max(0.15, Math.min(1.2, rotationX + deltaY * 0.005));

      previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domElement.addEventListener('touchstart', onTouchStart);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onTouchEnd);

    // Keep track of animation frames
    let animationFrameId: number;
    let clock = new THREE.Clock();

    // Shockwave simulation array for Solana tips
    const activeShockwaves: { x: number; z: number; age: number; intensity: number; maxAge: number }[] = [];

    const handleShockwaveTrigger = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      activeShockwaves.push({
        x: detail.x !== undefined ? detail.x : ballX,
        z: detail.z !== undefined ? detail.z : ballZ,
        age: 0,
        intensity: detail.intensity !== undefined ? detail.intensity : 1.0,
        maxAge: 1.5, // seconds
      });
    };
    window.addEventListener('shockwave-trigger', handleShockwaveTrigger);

    const initialFrame = propsRef.current.currentFrame;

    // Simulation targets for interpolation
    let targetTerrCenter = initialFrame.territoryCenter;
    let targetLeftHeight = initialFrame.leftHeight;
    let targetRightHeight = initialFrame.rightHeight;
    let isGoal = initialFrame.isGoal;
    let goalTeam = initialFrame.goalEvent?.team || 'home';
    let attackDirection = initialFrame.attackDirection;
    let targetWaveFrequency = initialFrame.waveFrequency ?? 0;
    let targetWaveAngle = initialFrame.waveAngle ?? 0;
    let targetRippleAge = initialFrame.rippleAge ?? 1;
    let targetShotPulse = initialFrame.shotPower ?? 0;
    let targetCornerPulse = initialFrame.isCorner ? 1.0 : 0;
    let targetFoulPulse = initialFrame.isFoul ? 0.8 : 0;
    let targetCardPulse = (initialFrame.isCard && initialFrame.cardType === 'red') ? 1.0 : (initialFrame.isCard && initialFrame.cardType === 'yellow') ? 0.5 : 0;
    let currentAction = initialFrame.lastAction ?? null;
    let targetHomePressure = initialFrame.homePressure ?? 0;
    let targetAwayPressure = initialFrame.awayPressure ?? 0;
    let targetMomentumShift = initialFrame.momentumShift ?? 0;
    let targetMatchFlowMultiplier = initialFrame.matchFlowMultiplier ?? 1.0;

    // Update targets when props change
    const updateInterpolationTargets = () => {
      const activeProps = propsRef.current;
      const curr = activeProps.currentFrame;
      const next = activeProps.nextFrame || curr;
      const progress = activeProps.playbackProgress;

      targetTerrCenter = THREE.MathUtils.lerp(curr.territoryCenter, next.territoryCenter, progress);
      targetLeftHeight = THREE.MathUtils.lerp(curr.leftHeight, next.leftHeight, progress);
      targetRightHeight = THREE.MathUtils.lerp(curr.rightHeight, next.rightHeight, progress);
      isGoal = curr.isGoal;
      goalTeam = curr.goalEvent?.team || next.goalEvent?.team || 'home';
      attackDirection = curr.attackDirection;
      targetWaveFrequency = THREE.MathUtils.lerp(curr.waveFrequency ?? 0, next.waveFrequency ?? 0, progress);
      targetWaveAngle = THREE.MathUtils.lerp(curr.waveAngle ?? 0, next.waveAngle ?? 0, progress);
      targetRippleAge = THREE.MathUtils.lerp(curr.rippleAge ?? 1, next.rippleAge ?? 1, progress);
      targetShotPulse = Math.max(curr.shotPower ?? 0, next.shotPower ?? 0) * (1 - progress);
      targetCornerPulse = (curr.isCorner || next.isCorner) ? 1.0 : 0;
      targetFoulPulse = (curr.isFoul || next.isFoul) ? 0.8 : 0;
      targetCardPulse = ((curr.isCard && curr.cardType === 'red') || (next.isCard && next.cardType === 'red')) ? 1.0
        : ((curr.isCard && curr.cardType === 'yellow') || (next.isCard && next.cardType === 'yellow')) ? 0.5 : 0;
      currentAction = curr.lastAction;
      targetHomePressure = THREE.MathUtils.lerp(curr.homePressure ?? 0, next.homePressure ?? 0, progress);
      targetAwayPressure = THREE.MathUtils.lerp(curr.awayPressure ?? 0, next.awayPressure ?? 0, progress);
      targetMomentumShift = Math.max(curr.momentumShift ?? 0, next.momentumShift ?? 0) * (1 - progress);
      targetMatchFlowMultiplier = THREE.MathUtils.lerp(curr.matchFlowMultiplier ?? 1.0, next.matchFlowMultiplier ?? 1.0, progress);
    };

    // Smooth values that lag behind slightly to avoid sudden jumps
    let smoothTerrCenter = targetTerrCenter;
    let smoothLeftHeight = targetLeftHeight;
    let smoothRightHeight = targetRightHeight;
    let smoothWaveFrequency = targetWaveFrequency;
    let smoothWaveAngle = targetWaveAngle;
    let smoothRippleAge = targetRippleAge;
    let smoothShotPulse = targetShotPulse;
    let smoothCornerPulse = targetCornerPulse;
    let smoothFoulPulse = targetFoulPulse;
    let smoothCardPulse = targetCardPulse;
    let smoothHomePressure = targetHomePressure;
    let smoothAwayPressure = targetAwayPressure;
    let smoothMomentumShift = targetMomentumShift;
    let smoothMatchFlowMultiplier = targetMatchFlowMultiplier;

    // Ball coordinate simulation variables
    let ballX = 0;
    let ballZ = 0;

    // Ball trail for motion visualization
    const ballTrail: { x: number; z: number; age: number }[] = [];
    const MAX_TRAIL = 14;

    // Help determine ball position based on the attack direction
    const getBallCoords = (frame: any) => {
      if (frame.ballX3d !== undefined && frame.ballZ3d !== undefined) {
        return { x: frame.ballX3d, z: frame.ballZ3d };
      }
      if (frame.isGoal) {
        // Ball resides in the net (Home goal at -9.1, Away goal at 9.1)
        const x = frame.goalEvent?.team === 'away' ? -9.1 : 9.1;
        return { x, z: 0 };
      }
      
      let x = 0;
      let z = 0;

      if (frame.attackDirection === 'home') {
        x = 4.8 + frame.territoryCenter * 2.5;
        z = Math.sin(frame.minute * 1.5) * 2.2;
      } else if (frame.attackDirection === 'away') {
        x = -4.8 + frame.territoryCenter * 2.5;
        z = Math.sin(frame.minute * 1.5) * 2.2;
      } else {
        // Midfield play
        x = frame.territoryCenter * 5.0;
        z = Math.sin(frame.minute * 2.0) * 1.8;
      }

      return { x, z };
    };

    // Animation loop
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      updateInterpolationTargets();

      const time = clock.getElapsedTime();

      // Update active shockwaves ages
      for (let i = activeShockwaves.length - 1; i >= 0; i--) {
        const sw = activeShockwaves[i];
        sw.age += 0.016; // rough 60fps delta
        if (sw.age > sw.maxAge) {
          activeShockwaves.splice(i, 1);
        }
      }

      // Soft lag interpolation for biological, fluid waves
      smoothTerrCenter += (targetTerrCenter - smoothTerrCenter) * 0.08;
      smoothLeftHeight += (targetLeftHeight - smoothLeftHeight) * 0.08;
      smoothRightHeight += (targetRightHeight - smoothRightHeight) * 0.08;
      smoothWaveFrequency += (targetWaveFrequency - smoothWaveFrequency) * 0.12;
      smoothWaveAngle += (targetWaveAngle - smoothWaveAngle) * 0.06;
      smoothRippleAge += (targetRippleAge - smoothRippleAge) * 0.1;
      smoothShotPulse += (targetShotPulse - smoothShotPulse) * 0.15;
      smoothCornerPulse += (targetCornerPulse - smoothCornerPulse) * 0.12;
      smoothFoulPulse += (targetFoulPulse - smoothFoulPulse) * 0.12;
      smoothCardPulse += (targetCardPulse - smoothCardPulse) * 0.1;
      smoothHomePressure += (targetHomePressure - smoothHomePressure) * 0.1;
      smoothAwayPressure += (targetAwayPressure - smoothAwayPressure) * 0.1;
      smoothMomentumShift += (targetMomentumShift - smoothMomentumShift) * 0.15;
      smoothMatchFlowMultiplier += (targetMatchFlowMultiplier - smoothMatchFlowMultiplier) * 0.08;
      const freshnessFactor = 1.0 - smoothRippleAge;

      // Update camera dynamically on sphere based on mouse/touch drag rotation angles
      const radius = 23;
      camera.position.x = radius * Math.sin(rotationY) * Math.cos(rotationX);
      camera.position.z = radius * Math.cos(rotationY) * Math.cos(rotationX);
      camera.position.y = radius * Math.sin(rotationX);
      camera.lookAt(0, -1.2, 0);

      // Read current dynamic props values securely
      const activeProps = propsRef.current;
      const curr = activeProps.currentFrame;
      const next = activeProps.nextFrame || curr;
      const progress = activeProps.playbackProgress;

      // Calculate smooth goal spike intensity (only when current frame is a goal)
      let goalSpikeFactor = 0;
      if (isGoal) {
        if (progress < 0.2) {
          goalSpikeFactor = progress / 0.2;
        } else if (progress < 0.7) {
          goalSpikeFactor = 1.0;
        } else {
          goalSpikeFactor = Math.max(0, (1.0 - progress) / 0.3);
        }
      }

      // 1. Ball position calculations with smooth frame-to-frame interpolation
      let targetBallX = 0;
      let targetBallZ = 0;

      if (curr.isGoal && !next.isGoal) {
        // Goal scored, ball starts in the net and then smoothly returns to the center of the pitch
        const goalSideX = curr.goalEvent?.team === 'away' ? -9.1 : 9.1;
        const nextBallCoords = getBallCoords(next);
        
        if (progress < 0.4) {
          // Linger in the net for celebration
          targetBallX = goalSideX;
          targetBallZ = 0;
        } else if (progress < 0.75) {
          // Ball returns to center circle (0,0)
          const t = (progress - 0.4) / 0.35;
          targetBallX = THREE.MathUtils.lerp(goalSideX, 0, t);
          targetBallZ = 0;
        } else {
          // Ball starts from center circle (0,0) and moves towards the next play position
          const t = (progress - 0.75) / 0.25;
          targetBallX = THREE.MathUtils.lerp(0, nextBallCoords.x, t);
          targetBallZ = THREE.MathUtils.lerp(0, nextBallCoords.z, t);
        }
      } else {
        // Standard fluid frame-to-frame interpolation
        const currentBallCoords = getBallCoords(curr);
        const nextBallCoords = getBallCoords(next);
        targetBallX = THREE.MathUtils.lerp(currentBallCoords.x, nextBallCoords.x, progress);
        targetBallZ = THREE.MathUtils.lerp(currentBallCoords.z, nextBallCoords.z, progress);
      }

      // Glide lag
      ballX += (targetBallX - ballX) * 0.12;
      ballZ += (targetBallZ - ballZ) * 0.12;

      // Ball color depending on team possession (highly saturated, immediate readability)
      if (attackDirection === 'home') {
        ballMat.color.setHex(0x0ea5e9);
      } else if (attackDirection === 'away') {
        ballMat.color.setHex(0xef4444);
      } else {
        ballMat.color.setHex(0xf59e0b); // Radiant Golden Amber for neutral
      }

      // Action-based ball bounce
      let ballBounceAmplitude = 0.22;
      let ballBounceFrequency = 6.5;
      if (currentAction === 'shot') {
        ballBounceAmplitude = 0.55;
        ballBounceFrequency = 12.0;
      } else if (currentAction === 'goal') {
        ballBounceAmplitude = 0.05;
        ballBounceFrequency = 3.0;
      } else if (currentAction === 'pass' || currentAction === 'dribble') {
        ballBounceAmplitude = 0.35;
        ballBounceFrequency = 8.0;
      } else if (currentAction === 'corner' || currentAction === 'free_kick') {
        ballBounceAmplitude = 0.4;
        ballBounceFrequency = 9.0;
      }
      const ballBounce = ballBounceAmplitude + Math.abs(Math.sin(time * ballBounceFrequency)) * ballBounceAmplitude * 0.8;

      // Position the glowing ball directly on the dynamically computed wave height, adding a bounce
      const ballHeightOnWave = getWaveHeightAt(ballX, ballZ, time, smoothTerrCenter, smoothLeftHeight, smoothRightHeight, goalSpikeFactor, goalTeam, ballX, ballZ, smoothWaveFrequency, smoothWaveAngle, freshnessFactor, smoothShotPulse, smoothCornerPulse, smoothFoulPulse, smoothCardPulse, smoothHomePressure, smoothAwayPressure, smoothMomentumShift, smoothMatchFlowMultiplier);
      ballGroup.position.set(ballX, ballHeightOnWave + ballBounce, ballZ);
      
      // Sync laser beam height to stretch from ball down to wave fabric
      ballBeam.scale.y = (ballBounce + 0.5) * 1.2;
      ballBeam.position.y = -ballBounce * 0.5;

      // Update ball trail
      ballTrail.push({ x: ballX, z: ballZ, age: 0 });
      if (ballTrail.length > MAX_TRAIL) ballTrail.shift();
      for (let ti = 0; ti < ballTrail.length; ti++) {
        ballTrail[ti].age += 0.016;
      }

      // 2. Update positions of the shared particle/mesh/wireframe geometry
      const positionsAttr = geometry.attributes.position;
      const colorsAttr = geometry.attributes.color;

      for (let i = 0; i < count; i++) {
        const worldX = positionsAttr.getX(i);
        const worldZ = positionsAttr.getZ(i);

        // Normalize X coordinates from -1 to 1 across fieldBounds for boundary colors
        const normX = worldX / (fieldWidth / 2);

        // Compute interactive wave height including the real-time ball ripple & goalpost spikes
        const waveHeight = getWaveHeightAt(
          worldX,
          worldZ,
          time,
          smoothTerrCenter,
          smoothLeftHeight,
          smoothRightHeight,
          goalSpikeFactor,
          goalTeam,
          ballX,
          ballZ,
          smoothWaveFrequency,
          smoothWaveAngle,
          freshnessFactor,
          smoothShotPulse,
          smoothCornerPulse,
          smoothFoulPulse,
          smoothCardPulse,
          smoothHomePressure,
          smoothAwayPressure,
          smoothMomentumShift,
          smoothMatchFlowMultiplier,
        );

        positionsAttr.setY(i, waveHeight);

        // Dynamic color transition — boundary follows both territory AND ball position
        const ballNormX = ballX / (fieldWidth / 2);
        const effectiveTerrCenter = smoothTerrCenter * 0.55 + ballNormX * 0.45;
        const distanceToDivision = normX - effectiveTerrCenter;
        const absDist = Math.abs(distanceToDivision);
        const t = Math.pow(Math.min(1.0, absDist * 4.2), 0.75);

        let r = 0.07, g = 0.07, b = 0.08;
        if (distanceToDivision > 0) {
          r = THREE.MathUtils.lerp(0.07, 0.88, t);
          g = THREE.MathUtils.lerp(0.07, 0.08, t);
          b = THREE.MathUtils.lerp(0.08, 0.12, t);
        } else {
          r = THREE.MathUtils.lerp(0.07, 0.08, t);
          g = THREE.MathUtils.lerp(0.07, 0.60, t);
          b = THREE.MathUtils.lerp(0.08, 0.96, t);
        }

        if (waveHeight > 0.8) {
          const bright = Math.min(1.0, (waveHeight - 0.8) / 2.0);
          r = THREE.MathUtils.lerp(r, Math.min(1.0, r * 2.2), bright * 0.85);
          g = THREE.MathUtils.lerp(g, Math.min(1.0, g * 2.2), bright * 0.85);
          b = THREE.MathUtils.lerp(b, Math.min(1.0, b * 2.2), bright * 0.85);
        }

        colorsAttr.setXYZ(i, r, g, b);
      }

      positionsAttr.needsUpdate = true;
      colorsAttr.needsUpdate = true;

      // 3. Project Field Markings to dynamic wave height (clinging perfectly to the hills!)
      fieldLines.forEach(line => {
        const linePosAttr = line.geometry.attributes.position;
        for (let j = 0; j < linePosAttr.count; j++) {
          const x = linePosAttr.getX(j);
          const z = linePosAttr.getZ(j);
          
          // Sample wave height
          const waveHeight = getWaveHeightAt(
            x,
            z,
            time,
            smoothTerrCenter,
            smoothLeftHeight,
            smoothRightHeight,
            goalSpikeFactor,
            goalTeam,
            ballX,
            ballZ,
            smoothWaveFrequency,
            smoothWaveAngle,
            freshnessFactor,
            smoothShotPulse,
            smoothCornerPulse,
            smoothFoulPulse,
            smoothCardPulse,
            smoothHomePressure,
            smoothAwayPressure,
            smoothMomentumShift,
            smoothMatchFlowMultiplier,
          );

          // Cling to wave surface with an increased lift offset (0.09) to ensure perfect visibility without clipping
          linePosAttr.setY(j, waveHeight + 0.09);
        }
        linePosAttr.needsUpdate = true;
      });

      if (isGoal) {
        const goalX = goalTeam === 'away' ? -9.0 : 9.0;

        const peakHeight = getWaveHeightAt(goalX, 0, time, smoothTerrCenter, smoothLeftHeight, smoothRightHeight, goalSpikeFactor, goalTeam, ballX, ballZ, smoothWaveFrequency, smoothWaveAngle, freshnessFactor, smoothShotPulse, smoothCornerPulse, smoothFoulPulse, smoothCardPulse, smoothHomePressure, smoothAwayPressure, smoothMomentumShift, smoothMatchFlowMultiplier);
        beaconRing.position.set(goalX, peakHeight + 0.15, 0);

        if (goalTeam === 'home') {
          ringMat.color.setHex(0x0284c7);
        } else {
          ringMat.color.setHex(0xe11d48);
        }

        // Pulse ring opacity and scale based on goalSpikeFactor
        ringMat.opacity = (0.70 + Math.sin(time * 5) * 0.2) * goalSpikeFactor;
        beaconRing.scale.setScalar((1.0 + Math.sin(time * 4) * 0.15) * goalSpikeFactor);

        // Update Floating scorer label overlay coordinates
        if (scorerLabelRef.current) {
          // Project peak of spike
          const labelVector = new THREE.Vector3(goalX, peakHeight + 1.2, 0);
          labelVector.project(camera);

          const screenX = (labelVector.x * 0.5 + 0.5) * width;
          const screenY = (-(labelVector.y * 0.5) + 0.5) * height;

          scorerLabelRef.current.style.display = goalSpikeFactor > 0.01 ? 'flex' : 'none';
          scorerLabelRef.current.style.opacity = `${goalSpikeFactor}`;
          scorerLabelRef.current.style.left = `${screenX}px`;
          scorerLabelRef.current.style.top = `${screenY}px`;

          if (scorerTextRef.current) {
            scorerTextRef.current.innerText = curr.goalEvent?.scorer || 'GOAL!';
          }
          if (scorerDotRef.current) {
            scorerDotRef.current.className = `w-2 h-2 rounded-full ${goalTeam === 'home' ? 'bg-sky-400 border border-black' : 'bg-rose-400 border border-black'}`;
          }
        }
      } else {
        ringMat.opacity = 0;
        if (scorerLabelRef.current) {
          scorerLabelRef.current.style.display = 'none';
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('shockwave-trigger', handleShockwaveTrigger);
      
      domElement.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domElement.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);

      if (mountRef.current && renderer.domElement) {
        if (mountRef.current.contains(renderer.domElement)) {
          mountRef.current.removeChild(renderer.domElement);
        }
      }
      geometry.dispose();
      meshMaterial.dispose();
      wireMaterial.dispose();
      pointsMaterial.dispose();
      lineMaterials.dispose();
      ballGeo.dispose();
      ballMat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();

      if (goalUprightGeo) goalUprightGeo.dispose();
      if (goalCrossbarGeo) goalCrossbarGeo.dispose();
      if (goalNetGeo) goalNetGeo.dispose();
      if (goalPostMat) goalPostMat.dispose();
      if (goalNetMat) goalNetMat.dispose();
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-[380px] md:min-h-[500px] overflow-hidden rounded-2xl bg-[#121212] border border-zinc-800 shadow-2xl">
      <div 
        ref={mountRef} 
        className="w-full h-full cursor-grab active:cursor-grabbing" 
      />
      
      {/* Floating 3D-to-2D Scorer Name Capsule */}
      <div 
        ref={scorerLabelRef}
        className="absolute bg-[#1E1E1E]/95 backdrop-blur text-white font-mono px-3 py-1.5 rounded-lg shadow-xl font-bold text-xs tracking-wide border border-zinc-700 pointer-events-none flex items-center gap-2 transition-all duration-75 ease-out"
        style={{ display: 'none', transform: 'translate(-50%, -100%)' }}
      >
        <span ref={scorerDotRef} className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
        <span ref={scorerTextRef} className="whitespace-nowrap font-black">Player Name</span>
      </div>
    </div>
  );
}
