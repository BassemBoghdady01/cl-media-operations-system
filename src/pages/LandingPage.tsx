import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import {
  ArrowRight, CheckCircle, Film, Calendar, Sparkles,
  MessageSquare, Clock, TrendingUp, Play, ChevronRight,
  Package, Eye, Users, BarChart3, FolderOpen, Zap,
  Star, Shield, Layers, AlignLeft, Hash, Target,
  AlertTriangle, X,
} from 'lucide-react'

// ─── Floating cards ──────────────────────────────────────────────────────────

function PipelineCard() {
  return (
    <div className="rounded-2xl p-4 w-64 shadow-[0_8px_40px_rgba(59,130,246,0.25)]"
      style={{ background: 'rgba(13,22,47,0.95)', border: '1px solid rgba(59,130,246,0.3)', backdropFilter: 'blur(16px)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.2)' }}>
          <Film className="w-3.5 h-3.5 text-blue-400" />
        </div>
        <span className="text-xs font-bold text-white">Video Pipeline</span>
        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full font-bold text-amber-400" style={{ background: 'rgba(245,158,11,0.15)' }}>3 urgent</span>
      </div>
      <div className="space-y-1.5">
        {[
          { title: 'Al Naseel Walk-Through Reel', stage: 'Client Review', color: '#F59E0B' },
          { title: 'Summer Collection Launch', stage: 'Editing', color: '#3B82F6' },
          { title: 'Ramadan Special Menu', stage: 'Scripting', color: '#8B5CF6' },
        ].map((item) => (
          <div key={item.title} className="flex items-center gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
            <span className="text-[10px] text-slate-300 flex-1 truncate">{item.title}</span>
            <span className="text-[9px] font-medium flex-shrink-0" style={{ color: item.color }}>{item.stage}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ApprovalCard() {
  return (
    <div className="rounded-2xl p-4 w-56 shadow-[0_8px_40px_rgba(16,185,129,0.2)]"
      style={{ background: 'rgba(13,22,47,0.95)', border: '1px solid rgba(16,185,129,0.25)', backdropFilter: 'blur(16px)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)' }}>
          <CheckCircle className="w-3.5 h-3.5 text-green-400" />
        </div>
        <span className="text-xs font-bold text-white">Client Approved</span>
      </div>
      <p className="text-[11px] text-white font-semibold">Al Naseel Tower Reel v2</p>
      <p className="text-[10px] text-slate-400 mt-0.5">Approved by Client Team</p>
      <div className="mt-2.5 flex items-center gap-2">
        <span className="text-[9px] px-2 py-0.5 rounded-full font-bold text-green-400" style={{ background: 'rgba(16,185,129,0.15)' }}>✓ Approved</span>
        <span className="text-[9px] text-slate-500">Just now</span>
      </div>
    </div>
  )
}

function AICard() {
  return (
    <div className="rounded-2xl p-4 w-64 shadow-[0_8px_40px_rgba(139,92,246,0.25)]"
      style={{ background: 'rgba(13,22,47,0.95)', border: '1px solid rgba(139,92,246,0.3)', backdropFilter: 'blur(16px)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.2)' }}>
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
        </div>
        <span className="text-xs font-bold text-white">AI Generated — Real Estate</span>
      </div>
      <div className="text-[10px] text-slate-300 leading-relaxed mb-2">
        <span className="text-amber-400 font-semibold">Hook:</span> "Have you seen what Al Naseel is building in New Capital?"
      </div>
      <div className="text-[10px] text-slate-400 leading-relaxed mb-2.5">
        Walk-through drone shot → lobby entrance → unit interior → rooftop view → CTA overlay
      </div>
      <div className="flex gap-1 flex-wrap">
        {['#NewCapital', '#Invest', '#RealEstate'].map((h) => (
          <span key={h} className="text-[9px] px-1.5 py-0.5 rounded-md text-purple-400" style={{ background: 'rgba(139,92,246,0.12)' }}>{h}</span>
        ))}
      </div>
    </div>
  )
}

function CalendarCard() {
  return (
    <div className="rounded-2xl p-4 w-52 shadow-[0_8px_40px_rgba(6,182,212,0.2)]"
      style={{ background: 'rgba(13,22,47,0.95)', border: '1px solid rgba(6,182,212,0.25)', backdropFilter: 'blur(16px)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.2)' }}>
          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <span className="text-xs font-bold text-white">May Calendar</span>
      </div>
      <div className="grid grid-cols-7 gap-px mb-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[8px] text-slate-600">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: 28 }).map((_, i) => {
          const hasPost = [2, 5, 9, 12, 16, 19, 23, 26].includes(i)
          const isToday = i === 14
          return (
            <div key={i} className={`h-5 rounded-sm flex items-center justify-center text-[8px] ${isToday ? 'bg-blue-500 text-white font-bold' : hasPost ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-700'}`}>
              {i + 1}
            </div>
          )
        })}
      </div>
      <p className="text-[9px] text-cyan-400 mt-2">8 posts scheduled ✓</p>
    </div>
  )
}

const floaters = [
  { id: 1, delay: 0, x: '62%', y: '6%', rotate: 3, yAnim: [-12, 0, -12] as [number, number, number], card: <PipelineCard /> },
  { id: 2, delay: 1.4, x: '68%', y: '42%', rotate: -2, yAnim: [0, -10, 0] as [number, number, number], card: <ApprovalCard /> },
  { id: 3, delay: 0.8, x: '5%', y: '48%', rotate: -3, yAnim: [-8, 4, -8] as [number, number, number], card: <CalendarCard /> },
  { id: 4, delay: 2, x: '56%', y: '72%', rotate: 2, yAnim: [0, -14, 0] as [number, number, number], card: <AICard /> },
]

// ─── Pain points ──────────────────────────────────────────────────────────────

const painPoints = [
  { icon: '💬', title: 'WhatsApp chaos', desc: 'Client feedback buried in 500 messages. Revision requests lost. Nobody knows what\'s approved.' },
  { icon: '🔄', title: 'Endless revisions', desc: '"Can you make the logo bigger?" — for the 8th time, across 4 different chats.' },
  { icon: '📁', title: 'Scattered files', desc: 'Google Drive, WeTransfer, Dropbox, email. Nobody knows which version is final.' },
  { icon: '🗓️', title: 'Missed deadlines', desc: 'No visibility on what\'s being worked on, by who, or when it\'s due.' },
  { icon: '💸', title: 'Invoice confusion', desc: 'Packages consumed but nobody tracked it. Clients dispute charges.' },
  { icon: '😤', title: 'Team confusion', desc: 'Editors don\'t know what to work on. Clients don\'t know what\'s happening.' },
]

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const pipeline = [
  { label: 'Idea', icon: '💡', color: '#64748B' },
  { label: 'Script', icon: '📝', color: '#8B5CF6' },
  { label: 'Shooting', icon: '🎥', color: '#F59E0B' },
  { label: 'Editing', icon: '✂️', color: '#3B82F6' },
  { label: 'QC', icon: '🔍', color: '#06B6D4' },
  { label: 'Review', icon: '👀', color: '#EAB308' },
  { label: 'Revision', icon: '🔄', color: '#EF4444' },
  { label: 'Approved', icon: '✅', color: '#10B981' },
  { label: 'Scheduled', icon: '📅', color: '#34D399' },
  { label: 'Posted', icon: '🚀', color: '#10B981' },
]

// ─── Features ─────────────────────────────────────────────────────────────────

const features = [
  { icon: Film, title: 'Video Pipeline', desc: 'Track every video from idea to posted across all clients. 10-stage Kanban board.', color: '#3B82F6' },
  { icon: Sparkles, title: 'AI Studio', desc: 'Generate reel ideas, scripts, captions, and hooks based on your client\'s industry and goal.', color: '#8B5CF6' },
  { icon: Eye, title: 'Client Portal', desc: 'Separate client-facing dashboard. Clean approval flow. No internal data exposed.', color: '#10B981' },
  { icon: Calendar, title: 'Content Calendar', desc: 'Visual monthly calendar for scheduling posts across Instagram, TikTok, YouTube.', color: '#06B6D4' },
  { icon: Package, title: 'Package Tracking', desc: 'Real-time usage of videos, revisions, and shooting days per client package.', color: '#F59E0B' },
  { icon: BarChart3, title: 'Analytics', desc: 'Revenue trends, video output, team performance, and client activity in one view.', color: '#EF4444' },
  { icon: Users, title: 'Team Management', desc: 'Assign tasks, track workload, and manage availability across your production team.', color: '#EC4899' },
  { icon: FolderOpen, title: 'Asset Library', desc: 'Store and organize brand logos, intros, music, and files by client — forever accessible.', color: '#34D399' },
]

// ─── Testimonials ─────────────────────────────────────────────────────────────

// Honest capability highlights — no invented customers or fabricated quotes.
const testimonials = [
  { name: 'One pipeline', role: 'Video Production', quote: 'Every video moves from idea to posted through one board — script, shoot, edit, review, approve.', avatar: '🎬' },
  { name: 'Real numbers', role: 'Finance & Payroll', quote: 'Revenue, expenses, subscriptions, payroll and P&L come straight from the ledger — never estimates.', avatar: '📊' },
  { name: 'Client portal', role: 'Client Experience', quote: 'Clients review videos, track their package and see their own invoices and payment schedule.', avatar: '🤝' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%'])
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0])

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#04081A' }}>

      {/* ── Navbar ──────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-12 h-16"
        style={{ background: 'rgba(4,8,26,0.88)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
            EZ
          </div>
          <span className="text-[15px] font-bold text-white">EZ Marketing Agency</span>
          <span className="hidden sm:block text-[10px] text-slate-600 pl-2 border-l border-slate-800">Media Operations System</span>
        </div>

        <div className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
          {['Pipeline', 'AI Studio', 'Client Portal', 'Packages', 'Analytics'].map((item) => (
            <a key={item} href={`#${item.toLowerCase().replace(/\s/g, '-')}`}
              className="hover:text-white transition-colors">{item}</a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-slate-400 hover:text-white transition-colors hidden sm:block">
            Sign In
          </Link>
          <Link to="/login" className="btn-primary text-sm py-2 px-5">
            Request Demo <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-16 overflow-hidden">

        {/* Background elements */}
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[140px] opacity-12 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3B82F6, transparent)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full blur-[120px] opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />
        <div className="absolute top-1/2 left-1/2 w-48 h-48 rounded-full blur-[100px] opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #06B6D4, transparent)' }} />

        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="relative w-full">
          <div className="max-w-7xl mx-auto px-6 lg:px-12 grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-4rem)] py-16">

            {/* Left: Text */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60A5FA' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                The complete media production OS
              </motion.div>

              <h1 className="text-4xl lg:text-5xl xl:text-6xl font-black text-white leading-[1.08] mb-6">
                From{' '}
                <span className="relative inline-block">
                  <span style={{ color: '#EF4444' }}>WhatsApp chaos</span>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                    className="absolute -bottom-1 left-0 right-0 h-0.5 origin-left"
                    style={{ background: 'linear-gradient(90deg, #EF4444, transparent)' }} />
                </span>
                <br />to a complete{' '}
                <span className="gradient-text">production OS</span>
              </h1>

              <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-lg">
                EZ Marketing Agency is the operations system for media production companies. Manage your entire video workflow — pipeline, clients, team, AI, billing — in one place.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <Link to="/login" className="btn-primary text-base py-3.5 px-7">
                  Start Free Demo <ArrowRight className="w-4 h-4" />
                </Link>
                <a href="#pipeline" className="btn-secondary text-base py-3.5 px-7">
                  <Play className="w-4 h-4" /> See How It Works
                </a>
              </div>

              <div className="flex flex-wrap gap-5">
                {[
                  { val: '150+', label: 'Agencies' },
                  { val: '50K+', label: 'Videos Managed' },
                  { val: '3×', label: 'Faster Delivery' },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <div className="text-xl font-black gradient-text-blue">{val}</div>
                    <div className="text-xs text-slate-500">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Right: Floating cards */}
            <div className="relative hidden lg:block h-[600px]">
              {floaters.map(({ id, delay, x, y, rotate, yAnim, card }) => (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    y: yAnim,
                    rotate,
                  }}
                  transition={{
                    opacity: { delay, duration: 0.5 },
                    scale: { delay, duration: 0.5 },
                    y: { delay, duration: 5, repeat: Infinity, ease: 'easeInOut' },
                    rotate: { delay, duration: 0.5 },
                  }}
                  className="absolute"
                  style={{ left: x, top: y }}>
                  {card}
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Pain Section ──────────────────────────────────────────── */}
      <section className="py-24 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent, rgba(239,68,68,0.03), transparent)' }} />
        </div>
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16">
            <span className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3 block">The Problem</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">Sound familiar?</h2>
            <p className="text-slate-400 text-lg max-w-xl mx-auto">
              Every content agency runs into the same walls. This is why they exist.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {painPoints.map((p, i) => (
              <motion.div
                key={p.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="p-5 rounded-2xl"
                style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.1)' }}>
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="text-sm font-bold text-white mb-1.5">{p.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution Section ──────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[150px] opacity-8"
            style={{ background: 'radial-gradient(circle, #3B82F6, transparent)' }} />
        </div>
        <div className="max-w-6xl mx-auto px-6 lg:px-12 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 block">The Solution</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">
              One system. Every operation. Zero chaos.
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto mb-8">
              EZ Marketing Agency replaces your scattered tools with a single, purpose-built platform for media production companies. From the first video idea to the final posted content.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Replace WhatsApp', 'Replace Google Sheets', 'Replace Trello', 'Replace Dropbox chaos', 'Replace Excel invoices'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs font-medium text-slate-300 px-3 py-1.5 rounded-full"
                  style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Pipeline Section ──────────────────────────────────────── */}
      <section id="pipeline" className="py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-14 text-center">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 block">Video Pipeline</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">Every video. Every stage. Total visibility.</h2>
            <p className="text-slate-400 text-base max-w-xl mx-auto">Track every video across your 10-stage production pipeline. Know exactly where everything is, at all times.</p>
          </motion.div>

          <div className="overflow-x-auto pb-4 no-scrollbar">
            <div className="flex items-center gap-2 min-w-max mx-auto">
              {pipeline.map((stage, i) => (
                <motion.div key={stage.label}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-2 text-center w-20">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
                      style={{ background: `${stage.color}15`, border: `1px solid ${stage.color}25` }}>
                      {stage.icon}
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400">{stage.label}</span>
                  </div>
                  {i < pipeline.length - 1 && (
                    <ChevronRight className="w-4 h-4 text-slate-700 flex-shrink-0" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="mt-10 grid md:grid-cols-3 gap-4">
            {[
              { icon: '🔍', title: 'Real-time tracking', desc: 'Know exactly which stage each video is in across all clients, right now.' },
              { icon: '👥', title: 'Team assignments', desc: 'Assign editors, scriptwriters, and social managers per video. No confusion.' },
              { icon: '📊', title: 'Pipeline analytics', desc: 'See bottlenecks, average time per stage, and team throughput at a glance.' },
            ].map((item, i) => (
              <motion.div key={item.title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                className="p-5 rounded-2xl" style={{ background: 'rgba(13,22,47,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="text-sm font-bold text-white mb-1.5">{item.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI Studio Section ─────────────────────────────────────── */}
      <section id="ai-studio" className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.3), transparent)' }} />
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.3), transparent)' }} />
          <div className="absolute top-1/2 right-0 w-96 h-96 rounded-full blur-[150px] opacity-8"
            style={{ background: 'radial-gradient(circle, #8B5CF6, transparent)' }} />
        </div>
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-3 block">AI Studio</span>
              <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">Content generation that actually understands your client</h2>
              <p className="text-slate-400 text-base mb-6 leading-relaxed">
                Enter the company name, industry, and goal — EZ Marketing Agency generates reel ideas, full scripts, hooks, captions, and campaign angles. Ready to use, or use as a starting point.
              </p>
              <div className="space-y-3 mb-8">
                {[
                  { icon: AlignLeft, label: 'Full reel scripts with timecodes and shot list', color: '#8B5CF6' },
                  { icon: Zap, label: '10 hook variations per topic', color: '#F59E0B' },
                  { icon: Hash, label: 'Platform-optimized captions + hashtags', color: '#3B82F6' },
                  { icon: Target, label: 'Strategic campaign angles', color: '#10B981' },
                  { icon: Calendar, label: '30-day content calendar', color: '#06B6D4' },
                ].map(({ icon: Icon, label, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${color}15` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                    </div>
                    <span className="text-sm text-slate-300">{label}</span>
                  </div>
                ))}
              </div>
              <Link to="/app/ai" className="btn-primary inline-flex">
                Try AI Studio <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="rounded-3xl p-6 relative"
              style={{ background: 'rgba(13,22,47,0.8)', border: '1px solid rgba(139,92,246,0.2)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(139,92,246,0.2)' }}>
                  <Sparkles className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-sm font-bold text-white">AI Studio — Real Estate Example</span>
              </div>
              <div className="space-y-3">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.06)' }}>
                  <p className="text-[9px] text-amber-500 uppercase tracking-wide mb-1">Input</p>
                  <p className="text-xs text-slate-300">Company: <strong className="text-white">Al Naseel</strong> · Real Estate · New Capital · Goal: Attract Investors</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(139,92,246,0.06)' }}>
                  <p className="text-[9px] text-purple-400 uppercase tracking-wide mb-1">Generated Hook</p>
                  <p className="text-xs text-slate-200 italic">"Have you seen what Al Naseel is building in New Capital?"</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)' }}>
                  <p className="text-[9px] text-blue-400 uppercase tracking-wide mb-1">Script Opening [0–3s]</p>
                  <p className="text-xs text-slate-300">Aerial drone shot of project site. On-screen: "📍 New Capital, Egypt"</p>
                </div>
                <div className="p-3 rounded-xl" style={{ background: 'rgba(16,185,129,0.06)' }}>
                  <p className="text-[9px] text-green-500 uppercase tracking-wide mb-1">CTA</p>
                  <p className="text-xs text-slate-300">DM "INVEST" for the full project brochure and payment plan</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['#AlNaseel', '#NewCapital', '#استثمار_عقاري', '#RealEstate'].map((h) => (
                    <span key={h} className="text-[9px] px-1.5 py-0.5 rounded-md text-purple-400" style={{ background: 'rgba(139,92,246,0.1)' }}>{h}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Client Portal Section ─────────────────────────────────── */}
      <section id="client-portal" className="py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
              className="rounded-3xl overflow-hidden"
              style={{ background: 'rgba(13,22,47,0.8)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(16,185,129,0.04)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.2)' }}>
                    <Eye className="w-3.5 h-3.5 text-green-400" />
                  </div>
                  <span className="text-xs font-bold text-white">Client Dashboard — Al Naseel</span>
                </div>
                <span className="text-[9px] text-blue-300 font-medium px-2 py-0.5 rounded-full animate-pulse"
                  style={{ background: 'rgba(59,130,246,0.1)' }}>1 video awaiting review</span>
              </div>
              <div className="p-5 space-y-3">
                <div className="p-3 rounded-xl" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <p className="text-xs font-bold text-white mb-1">Al Naseel Tower Walk-Through Reel v2</p>
                  <p className="text-[10px] text-blue-300 mb-2.5">Action required — please review and approve</p>
                  <div className="flex gap-2">
                    <button className="flex-1 text-[10px] py-1.5 rounded-lg font-semibold text-slate-400"
                      style={{ background: 'rgba(255,255,255,0.05)' }}>Request Changes</button>
                    <button className="flex-1 text-[10px] py-1.5 rounded-lg font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>✓ Approve</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-[9px] text-slate-600 mb-1">Package Usage</p>
                    <p className="text-xs font-bold text-white">8/12 videos</p>
                    <div className="mt-1 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full w-2/3" style={{ background: '#3B82F6' }} />
                    </div>
                  </div>
                  <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p className="text-[9px] text-slate-600 mb-1">Upcoming Shoot</p>
                    <p className="text-xs font-bold text-white">May 10</p>
                    <p className="text-[9px] text-slate-500">10:00 · EZ Studio</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <span className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3 block">Client Portal</span>
              <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">A separate world for your clients</h2>
              <p className="text-slate-400 text-base mb-6 leading-relaxed">
                Clients get their own clean dashboard. They see their videos, approve content, request revisions, check their package, and download files — without ever seeing your internal operations.
              </p>
              <div className="space-y-2.5 mb-8">
                {[
                  'Approve or request revision in one click',
                  'See exactly where their videos are in production',
                  'View package usage in real time',
                  'Download final delivered files',
                  'Upload brand assets directly',
                  'No internal data or team info exposed',
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
              <Link to="/client" className="btn-secondary inline-flex">
                View Client Demo <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ─────────────────────────────────────────── */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-6 lg:px-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <span className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-3 block">Everything You Need</span>
            <h2 className="text-3xl lg:text-4xl font-black text-white mb-4">Built for media production teams</h2>
            <p className="text-slate-400 text-base max-w-lg mx-auto">Every feature designed specifically for content agencies and video production companies.</p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ y: -3 }}
                className="p-5 rounded-2xl"
                style={{ background: 'rgba(13,22,47,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${f.color}15` }}>
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────── */}
      <section className="py-24 relative">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, transparent, rgba(59,130,246,0.04), transparent)' }} />
        <div className="max-w-5xl mx-auto px-6 lg:px-12">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <h2 className="text-3xl font-black text-white mb-2">What agencies say</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <motion.div key={t.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="p-6 rounded-2xl"
                style={{ background: 'rgba(13,22,47,0.7)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-sm text-slate-200 leading-relaxed mb-5">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>{t.avatar}</div>
                  <div>
                    <div className="text-xs font-bold text-white">{t.name}</div>
                    <div className="text-[10px] text-slate-500">{t.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[400px] rounded-full blur-[150px] opacity-12"
            style={{ background: 'radial-gradient(ellipse, #3B82F6, #8B5CF6, transparent)' }} />
        </div>
        <div className="max-w-3xl mx-auto px-6 lg:px-12 text-center relative">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-5">
              Ready to run your agency<br />like a machine?
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              Join media production companies that replaced their chaos with EZ Marketing Agency.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to="/login" className="btn-primary text-base py-4 px-8">
                Start Free Demo <ArrowRight className="w-4 h-4" />
              </Link>
              <Link to="/client" className="btn-secondary text-base py-4 px-8">
                View Client Portal
              </Link>
            </div>
            <p className="text-xs text-slate-600 mt-5">No credit card required · Setup in 5 minutes · Demo data included</p>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-white text-xs"
              style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>EZ</div>
            <span className="text-sm font-bold text-white">EZ Marketing Agency</span>
            <span className="text-xs text-slate-600">Media Operations System</span>
          </div>
          <div className="flex gap-6 text-xs text-slate-500">
            {['Privacy', 'Terms', 'Support'].map((l) => (
              <a key={l} href="#" className="hover:text-slate-300 transition-colors">{l}</a>
            ))}
          </div>
          <p className="text-xs text-slate-600">© 2025 EZ Marketing Agency. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
