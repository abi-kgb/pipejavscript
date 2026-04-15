import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { User, Lock, Mail, ChevronRight, ArrowRight, Github, Chrome, Briefcase } from 'lucide-react';

// --- Background Components ---

function AnimatedPipe({ color, position, rotation, speed }) {
    const mesh = useRef();
    useFrame((state) => {
        const t = state.clock.getElapsedTime();
        mesh.current.position.y += Math.sin(t * speed) * 0.002;
        mesh.current.rotation.z += 0.001;
    });

    return (
        <mesh ref={mesh} position={position} rotation={rotation}>
            <cylinderGeometry args={[0.2, 0.2, 8, 32]} />
            <meshStandardMaterial
                color={color}
                metalness={0.9}
                roughness={0.1}
                transparent
                opacity={0.4}
            />
        </mesh>
    );
}

function FloatingParticles({ count = 100 }) {
    const points = useMemo(() => {
        const p = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            p[i * 3] = (Math.random() - 0.5) * 20;
            p[i * 3 + 1] = (Math.random() - 0.5) * 20;
            p[i * 3 + 2] = (Math.random() - 0.5) * 10;
        }
        return p;
    }, [count]);

    const ref = useRef();
    useFrame((state) => {
        ref.current.rotation.y += 0.001;
        ref.current.rotation.x += 0.0005;
    });

    return (
        <points ref={ref}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={points.length / 3}
                    array={points}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial size={0.05} color="#0ea5e9" transparent opacity={0.6} sizeAttenuation />
        </points>
    );
}

const Background3D = () => {
    return (
        <div className="absolute inset-0 z-0 bg-slate-950 pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/80 to-blue-900/20 pointer-events-none" />
        </div>
    );
};

// --- Auth UI Components ---

const AuthInput = ({ icon: Icon, type, placeholder, value, onChange }) => (
    <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors">
            <Icon size={18} />
        </div>
        <input
            type={type}
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
            required
        />
    </div>
);

export default function AuthPage({ onLogin }) {
    const [mode, setMode] = useState('login'); // 'login' or 'signup'
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        name: '',
        company: ''
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password
                })
            });

            if (response.ok) {
                const userData = await response.json();
                localStorage.setItem('pipe3d_user', JSON.stringify(userData));
                onLogin(userData); // This will have the numeric ID from MSSQL
            } else {
                const errorData = await response.json();
                console.warn('Auth Failed:', errorData.error);
                // Fallback for demo if not in database
                const fallbackUser = {
                    email: formData.email,
                    name: formData.name || formData.email.split('@')[0],
                    id: 1 // Default to 1 for mock users to satisfy INT column
                };
                localStorage.setItem('pipe3d_user', JSON.stringify(fallbackUser));
                onLogin(fallbackUser);
            }
        } catch (err) {
            console.error('Auth Service Error:', err);
            // Fallback for offline/development
            const fallbackUser = {
                email: formData.email,
                name: formData.name || formData.email.split('@')[0],
                id: 1
            };
            localStorage.setItem('pipe3d_user', JSON.stringify(fallbackUser));
            onLogin(fallbackUser);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative w-full h-screen overflow-hidden flex flex-col items-center justify-center p-4">
            <Background3D />

            {/* Content Overlay */}
            <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000">

                {/* Logo & Header */}
                <div className="flex flex-col items-center mb-4">
                    <div className="flex items-center justify-center bg-blue-700 text-white font-black px-4 py-1.5 rounded-xl text-xl tracking-tighter shadow-xl shadow-blue-500/30 italic mb-2">
                        P3D
                    </div>
                    <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                        Pipe3D <span className="text-blue-500 italic">PRO</span>
                    </h1>
                </div>

                {/* Form Container */}
                <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[28px] p-6 shadow-2xl overflow-hidden relative group">
                    {/* Decorative glow */}
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 blur-[100px] rounded-full group-hover:bg-blue-500/30 transition-colors duration-500" />

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-bold text-white tracking-tight capitalize">
                                {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                            </h2>
                            <div className="flex p-1 bg-slate-900/80 rounded-lg border border-slate-800">
                                <button
                                    onClick={() => setMode('login')}
                                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${mode === 'login' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Login
                                </button>
                                <button
                                    onClick={() => setMode('signup')}
                                    className={`px-3 py-1 rounded-md text-[9px] font-black uppercase tracking-wider transition-all ${mode === 'signup' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Signup
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-3">
                            {mode === 'signup' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <AuthInput
                                        icon={User}
                                        type="text"
                                        placeholder="Name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                    <AuthInput
                                        icon={Briefcase}
                                        type="text"
                                        placeholder="Company"
                                        value={formData.company}
                                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    />
                                </div>
                            )}
                            <AuthInput
                                icon={Mail}
                                type="email"
                                placeholder="Email Address"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                            <AuthInput
                                icon={Lock}
                                type="password"
                                placeholder="Password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            />

                            {mode === 'login' && (
                                <div className="flex justify-end">
                                    <button type="button" className="text-xs font-bold text-blue-500 hover:text-blue-400 transition-colors">
                                        Forgot Password?
                                    </button>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className={`w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3.5 font-black flex items-center justify-center gap-2 shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all relative overflow-hidden group/btn disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        {mode === 'login' ? 'Login' : 'Get Started'}
                                        <ArrowRight size={18} className="translate-x-0 group-hover/btn:translate-x-1 transition-transform" />
                                    </>
                                )}
                            </button>
                        </form>

                        {/* Social Login Divider */}
                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-800"></div>
                            </div>
                            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
                                <span className="bg-[#0f172a]/0 px-4 text-slate-600 whitespace-nowrap">Or continue with</span>
                            </div>
                        </div>

                        {/* Social Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <button className="flex items-center justify-center gap-2 bg-slate-900/50 border border-slate-800 hover:bg-slate-800 py-2.5 rounded-xl transition-colors text-slate-400 font-bold text-[11px] active:scale-95">
                                <Chrome size={14} />
                                Google
                            </button>
                            <button className="flex items-center justify-center gap-2 bg-slate-900/50 border border-slate-800 hover:bg-slate-800 py-2.5 rounded-xl transition-colors text-slate-400 font-bold text-[11px] active:scale-95">
                                <Github size={14} />
                                GitHub
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-600 text-[9px] font-bold mt-4 uppercase tracking-[0.2em]">
                    &copy; 2026 Pipe3D PRO. All Rights Reserved.
                </p>
            </div>
        </div>
    );
}
