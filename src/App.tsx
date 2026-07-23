import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Activity,
  Apple,
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Dumbbell,
  Droplets,
  Flame,
  Gauge,
  Home,
  LogOut,
  Mail,
  Pause,
  Play,
  Plus,
  Scale,
  Settings2,
  Sparkles,
  Target,
  TimerReset,
  TrendingDown,
  Trophy,
  UserRound,
  Utensils,
  Weight,
  X,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabase";
import {
  bmiLabel,
  calculateAge,
  calculateBmi,
  calorieBurn,
  estimatedDailyCalories,
  generateWorkout,
  proteinTarget,
} from "./lib/health";
import { addMeal, saveProfile, saveWater, saveWeight } from "./lib/store";
import { estimateNutrition } from "./lib/nutrition";
import type { Exercise, Meal, Profile, Tab, WorkoutSession } from "./types";

const defaultProfile: Profile = {
  name: "Yas",
  birthDate: "1995-05-07",
  sex: "female",
  heightCm: 152,
  weightKg: 89.4,
  goalWeightKg: 70,
  activityLevel: "light",
  equipment: ["Halteres", "Puxador", "Bicicleta"],
  limitations: "Baixa resistência cardiovascular",
};

const formatSeconds = (seconds: number) => {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
};

const todayLabel = () =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date());

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [tab, setTab] = useState<Tab>("hoje");
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [water, setWater] = useState(1500);
  const [waterGoal, setWaterGoal] = useState(3000);
  const [meals, setMeals] = useState<Meal[]>([
    { id: "1", name: "Omelete com queijo", protein: 24, calories: 320, time: "08:10" },
    { id: "2", name: "Frango, arroz e salada", protein: 42, calories: 510, time: "12:45" },
  ]);
  const [exercises, setExercises] = useState<Exercise[]>(() => generateWorkout(defaultProfile));
  const [workout, setWorkout] = useState<WorkoutSession>({
    startedAt: null,
    elapsedSeconds: 0,
    running: false,
  });
  const [showMeal, setShowMeal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingAuth(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!workout.running) return;
    const interval = window.setInterval(() => {
      setWorkout((current) => ({ ...current, elapsedSeconds: current.elapsedSeconds + 1 }));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [workout.running]);

  const userId = session?.user.id;
  const bmi = calculateBmi(profile.weightKg, profile.heightCm);
  const protein = meals.reduce((total, meal) => total + meal.protein, 0);
  const caloriesIn = meals.reduce((total, meal) => total + meal.calories, 0);
  const proteinGoal = proteinTarget(profile.weightKg);
  const completedExercises = exercises.filter((exercise) => exercise.completed).length;
  const workoutMet = exercises.length
    ? exercises.reduce((total, exercise) => total + exercise.met, 0) / exercises.length
    : 4;
  const caloriesBurned = calorieBurn(workoutMet, profile.weightKg, workout.elapsedSeconds);
  const weeklyGoals = [
    { label: "Treinar 3 vezes", value: 2, goal: 3, icon: Dumbbell },
    { label: "Bater a meta de água", value: 4, goal: 7, icon: Droplets },
    { label: "Registrar alimentação", value: 5, goal: 7, icon: Apple },
  ];

  if (loadingAuth) return <Splash />;
  if (!session && !demoMode) return <AuthScreen onDemo={() => setDemoMode(true)} />;

  const changeWater = async (next: number) => {
    const safe = Math.max(0, Math.min(next, 6000));
    setWater(safe);
    if (userId) await saveWater(userId, safe);
  };

  const updateExercise = (id: string, changes: Partial<Exercise>) => {
    setExercises((current) => current.map((exercise) => (exercise.id === id ? { ...exercise, ...changes } : exercise)));
  };

  const regenerateWorkout = () => {
    setExercises(generateWorkout(profile));
    setWorkout({ startedAt: null, elapsedSeconds: 0, running: false });
  };

  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Brand />
        <nav>{(["hoje", "treino", "progresso", "perfil"] as Tab[]).map((item) => <NavButton key={item} tab={item} active={tab === item} onClick={setTab} />)}</nav>
        <div className="sidebar-quote">
          <Sparkles size={20} />
          <p>Consistência supera intensidade. Um dia de cada vez.</p>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <Brand compact />
          <div className="topbar-actions">
            {demoMode && <span className="demo-pill">Modo demonstração</span>}
            <button className="avatar" onClick={() => setTab("perfil")} aria-label="Abrir perfil">
              {session?.user.user_metadata?.avatar_url ? <img src={session.user.user_metadata.avatar_url} alt="" /> : profile.name.slice(0, 1)}
            </button>
          </div>
        </header>

        {tab === "hoje" && (
          <TodayView
            profile={profile}
            bmi={bmi}
            water={water}
            waterGoal={waterGoal}
            protein={protein}
            proteinGoal={proteinGoal}
            caloriesIn={caloriesIn}
            caloriesBurned={caloriesBurned}
            workout={workout}
            completedExercises={completedExercises}
            totalExercises={exercises.length}
            goals={weeklyGoals}
            onWater={changeWater}
            onMeal={() => setShowMeal(true)}
            onWorkout={() => setTab("treino")}
          />
        )}

        {tab === "treino" && (
          <WorkoutView
            exercises={exercises}
            workout={workout}
            calories={caloriesBurned}
            weightKg={profile.weightKg}
            updateExercise={updateExercise}
            onToggleTimer={() =>
              setWorkout((current) => ({
                ...current,
                startedAt: current.startedAt ?? Date.now(),
                running: !current.running,
              }))
            }
            onReset={() => setWorkout({ startedAt: null, elapsedSeconds: 0, running: false })}
            onRegenerate={regenerateWorkout}
          />
        )}

        {tab === "progresso" && <ProgressView profile={profile} bmi={bmi} goals={weeklyGoals} />}

        {tab === "perfil" && (
          <ProfileView
            profile={profile}
            setProfile={setProfile}
            waterGoal={waterGoal}
            setWaterGoal={setWaterGoal}
            onSave={async () => {
              if (userId) {
                await Promise.all([saveProfile(userId, profile), saveWeight(userId, profile.weightKg)]);
              }
              regenerateWorkout();
              setShowProfile(false);
            }}
            onLogout={async () => {
              if (demoMode) setDemoMode(false);
              else await supabase.auth.signOut();
            }}
          />
        )}
      </main>

      <nav className="mobile-nav">
        {(["hoje", "treino", "progresso", "perfil"] as Tab[]).map((item) => <NavButton key={item} tab={item} active={tab === item} onClick={setTab} />)}
      </nav>

      {showMeal && (
        <MealModal
          onClose={() => setShowMeal(false)}
          onSave={async (meal) => {
            setMeals((current) => [...current, meal]);
            if (userId) await addMeal(userId, meal);
            setShowMeal(false);
          }}
        />
      )}
      {showProfile && <div />}
    </div>
  );
}

function Splash() {
  return (
    <div className="splash">
      <div className="brand-mark"><TrendingDown /></div>
      <span>Evolua</span>
    </div>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <div className="brand-mark"><TrendingDown /></div>
      <div><strong>Evolua</strong>{!compact && <small>Diário de saúde</small>}</div>
    </div>
  );
}

function AuthScreen({ onDemo }: { onDemo: () => void }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const loginEmail = async () => {
    if (!email) return;
    setError("");
    if (!supabaseConfigured) {
      setError("O acesso ainda não foi configurado. As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão ausentes no deploy.");
      return;
    }
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (authError) setError(authError.message);
    else setSent(true);
  };

  return (
    <div className="auth-page">
      <section className="auth-visual">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow"><Sparkles size={15} /> Saúde sem complicação</span>
          <h1>Seu progresso merece ser <em>visto.</em></h1>
          <p>Treinos inteligentes, alimentação, água e pequenas vitórias reunidos em um diário feito para a vida real.</p>
          <div className="auth-proof">
            <div><Droplets /><strong>3,0 L</strong><span>Meta de água</span></div>
            <div><Dumbbell /><strong>3x</strong><span>Treinos semanais</span></div>
            <div><Trophy /><strong>12</strong><span>Conquistas</span></div>
          </div>
        </div>
        <p className="auth-note">Evolução sustentável, no seu ritmo.</p>
      </section>

      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void loginEmail(); }}>
          <div className="mobile-auth-brand"><Brand /></div>
          <span className="eyebrow neutral">Bem-vinda ao Evolua</span>
          <h2>Comece seu diário</h2>
          <p>Entre para acompanhar sua jornada com privacidade.</p>
          {sent ? (
            <div className="success-message"><Mail /><div><strong>Confira sua caixa de entrada</strong><span>Enviamos um link de acesso para {email}.</span></div></div>
          ) : (
            <>
              <label className="field">
                <span>Seu e-mail</span>
                <div className="input-with-icon"><Mail size={18} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></div>
              </label>
              <button type="submit" className="primary-button" disabled={!email}>Enviar link de acesso <ArrowRight size={18} /></button>
            </>
          )}
          {error && <p className="form-error">{error}</p>}
          <button className="text-button" onClick={onDemo}>Explorar demonstração</button>
          <small className="privacy-copy">Ao entrar, você concorda com os termos e a política de privacidade. Seus dados de saúde ficam protegidos.</small>
        </form>
      </section>
    </div>
  );
}

function TodayView(props: {
  profile: Profile;
  bmi: number;
  water: number;
  waterGoal: number;
  protein: number;
  proteinGoal: number;
  caloriesIn: number;
  caloriesBurned: number;
  workout: WorkoutSession;
  completedExercises: number;
  totalExercises: number;
  goals: { label: string; value: number; goal: number; icon: typeof Dumbbell }[];
  onWater: (value: number) => void;
  onMeal: () => void;
  onWorkout: () => void;
}) {
  const remaining = Math.max(0, props.profile.weightKg - props.profile.goalWeightKg);
  return (
    <div className="page today-page">
      <div className="page-heading">
        <div><span className="eyebrow neutral">{todayLabel()}</span><h1>Olá, {props.profile.name} <span>👋</span></h1><p>Que tal cuidar de você um pouco hoje?</p></div>
        <div className="streak"><Flame /><div><strong>6 dias</strong><span>de sequência</span></div></div>
      </div>

      <section className="hero-progress">
        <div>
          <span className="soft-label"><Target size={15} /> Rumo à sua meta</span>
          <h2>{props.profile.weightKg.toFixed(1).replace(".", ",")} <small>kg</small></h2>
          <p>Faltam <strong>{remaining.toFixed(1).replace(".", ",")} kg</strong> para sua meta de {props.profile.goalWeightKg} kg</p>
        </div>
        <div className="weight-journey">
          <div className="journey-labels"><span>Início <strong>92,0 kg</strong></span><span>Meta <strong>{props.profile.goalWeightKg} kg</strong></span></div>
          <div className="progress-track"><span style={{ width: "14%" }} /></div>
          <p><TrendingDown size={15} /> Você já eliminou <strong>2,6 kg</strong>. Continue assim!</p>
        </div>
      </section>

      <div className="metric-grid">
        <MetricCard icon={Droplets} tone="blue" label="Água" value={`${(props.water / 1000).toFixed(1).replace(".", ",")} L`} meta={`de ${(props.waterGoal / 1000).toFixed(1)} L`} progress={props.water / props.waterGoal} action={<button onClick={() => props.onWater(props.water + 250)}><Plus /> 250 ml</button>} />
        <MetricCard icon={Apple} tone="peach" label="Proteína" value={`${props.protein} g`} meta={`de ${props.proteinGoal} g`} progress={props.protein / props.proteinGoal} action={<button onClick={props.onMeal}><Plus /> Refeição</button>} />
        <MetricCard icon={Flame} tone="orange" label="Calorias" value={`${props.caloriesIn}`} meta="ingeridas hoje" progress={props.caloriesIn / Math.max(estimatedDailyCalories(props.profile) - 400, 1)} footer={`${props.caloriesBurned} kcal gastas no treino`} />
        <MetricCard icon={Gauge} tone="green" label="IMC atual" value={props.bmi.toFixed(1).replace(".", ",")} meta={bmiLabel(props.bmi)} progress={Math.min(props.bmi / 45, 1)} footer="Acompanhe, sem julgamentos" />
      </div>

      <div className="content-grid">
        <section className="panel workout-preview">
          <div className="panel-heading"><div><span className="eyebrow neutral">Seu movimento de hoje</span><h3>Treino de adaptação</h3></div><span className="duration"><Clock3 /> 35 min</span></div>
          <div className="workout-illustration"><div className="pulse-ring"><Dumbbell /></div><div><strong>{props.completedExercises}/{props.totalExercises}</strong><span>exercícios concluídos</span></div></div>
          <div className="mini-progress"><span style={{ width: `${(props.completedExercises / props.totalExercises) * 100}%` }} /></div>
          <button className="primary-button" onClick={props.onWorkout}>{props.workout.elapsedSeconds ? "Continuar treino" : "Começar treino"} <Play size={17} fill="currentColor" /></button>
        </section>

        <section className="panel goals-panel">
          <div className="panel-heading"><div><span className="eyebrow neutral">Semana atual</span><h3>Metas da semana</h3></div><Award /></div>
          <div className="goal-list">
            {props.goals.map((goal) => {
              const Icon = goal.icon;
              return <div className="goal-item" key={goal.label}><span className="goal-icon"><Icon /></span><div><strong>{goal.label}</strong><div className="mini-progress"><span style={{ width: `${(goal.value / goal.goal) * 100}%` }} /></div></div><b>{goal.value}/{goal.goal}</b></div>;
            })}
          </div>
          <div className="next-medal"><Trophy /><div><span>Próxima medalha</span><strong>Semana Equilibrada</strong></div><span>2 metas</span></div>
        </section>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, tone, label, value, meta, progress, action, footer }: {
  icon: typeof Droplets; tone: string; label: string; value: string; meta: string; progress: number; action?: React.ReactNode; footer?: string;
}) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-top"><span className="metric-icon"><Icon /></span><span>{label}</span></div>
      <div className="metric-value"><strong>{value}</strong><span>{meta}</span></div>
      <div className="mini-progress"><span style={{ width: `${Math.min(progress * 100, 100)}%` }} /></div>
      {action ?? <small>{footer}</small>}
    </article>
  );
}

function WorkoutView({ exercises, workout, calories, updateExercise, onToggleTimer, onReset, onRegenerate }: {
  exercises: Exercise[];
  workout: WorkoutSession;
  calories: number;
  weightKg: number;
  updateExercise: (id: string, changes: Partial<Exercise>) => void;
  onToggleTimer: () => void;
  onReset: () => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="page">
      <div className="page-heading workout-heading">
        <div><span className="eyebrow neutral">Plano inteligente • adaptação</span><h1>Seu treino de hoje</h1><p>Exercícios escolhidos conforme seus equipamentos e condicionamento.</p></div>
        <button className="secondary-button" onClick={onRegenerate}><Sparkles /> Gerar novo plano</button>
      </div>

      <section className={`timer-card ${workout.running ? "active" : ""}`}>
        <div><span className="timer-status"><span />{workout.running ? "Treino em andamento" : workout.elapsedSeconds ? "Treino pausado" : "Pronta para começar?"}</span><strong>{formatSeconds(workout.elapsedSeconds)}</strong></div>
        <div className="timer-stats"><span><Flame /> {calories} kcal</span><span><Check /> {exercises.filter((item) => item.completed).length}/{exercises.length} exercícios</span></div>
        <div className="timer-actions">
          <button className="timer-main" onClick={onToggleTimer}>{workout.running ? <Pause fill="currentColor" /> : <Play fill="currentColor" />} {workout.running ? "Pausar" : "Iniciar"}</button>
          {workout.elapsedSeconds > 0 && <button className="timer-reset" onClick={onReset} aria-label="Zerar cronômetro"><TimerReset /></button>}
        </div>
      </section>

      <section className="exercise-list">
        {exercises.map((exercise, index) => (
          <article className={`exercise-card ${exercise.completed ? "completed" : ""}`} key={exercise.id}>
            <button className="exercise-check" onClick={() => updateExercise(exercise.id, { completed: !exercise.completed })} aria-label="Marcar exercício">{exercise.completed ? <Check /> : index + 1}</button>
            <div className="exercise-main">
              <div className="exercise-title"><div><span>{exercise.muscle} • {exercise.equipment}</span><h3>{exercise.name}</h3></div><span className="rest-time"><Clock3 /> {exercise.restSeconds ? `${exercise.restSeconds}s` : "contínuo"}</span></div>
              <div className="exercise-prescription">
                <div><span>Séries</span><strong>{exercise.sets}</strong></div>
                <div><span>Repetições</span><strong>{exercise.reps}</strong></div>
                <label><span>Carga usada</span><div><input type="number" min="0" step="0.5" value={exercise.weight} onChange={(event) => updateExercise(exercise.id, { weight: Number(event.target.value) })} /><b>kg</b></div></label>
              </div>
            </div>
          </article>
        ))}
      </section>
      <div className="safety-note"><Activity /><p><strong>Escute seu corpo.</strong> Pare se sentir dor, tontura ou falta de ar fora do esperado. O plano não substitui avaliação profissional.</p></div>
    </div>
  );
}

function ProgressView({ profile, bmi, goals }: { profile: Profile; bmi: number; goals: { label: string; value: number; goal: number; icon: typeof Dumbbell }[] }) {
  const bars = [92, 91.6, 91.2, 90.8, 90.5, 90.1, 89.7, profile.weightKg];
  const max = Math.max(...bars);
  const min = Math.min(...bars) - 1;
  return (
    <div className="page">
      <div className="page-heading"><div><span className="eyebrow neutral">Sua jornada</span><h1>Progresso</h1><p>Mais que números: aqui ficam as provas da sua constância.</p></div><button className="secondary-button"><CalendarDays /> Últimos 30 dias</button></div>
      <div className="progress-stats">
        <div><Scale /><span>Peso atual</span><strong>{profile.weightKg.toFixed(1).replace(".", ",")} kg</strong><small><TrendingDown /> −2,6 kg no período</small></div>
        <div><Gauge /><span>IMC</span><strong>{bmi.toFixed(1).replace(".", ",")}</strong><small>{bmiLabel(bmi)}</small></div>
        <div><Dumbbell /><span>Treinos</span><strong>8</strong><small>6h12 em movimento</small></div>
        <div><Flame /><span>Sequência</span><strong>6 dias</strong><small>Seu recorde é 9</small></div>
      </div>
      <section className="panel chart-panel">
        <div className="panel-heading"><div><span className="eyebrow neutral">Evolução do peso</span><h3>Você está seguindo na direção certa</h3></div><span className="positive-chip"><TrendingDown /> −2,8%</span></div>
        <div className="bar-chart">
          {bars.map((value, index) => <div key={index} className="bar-wrap"><span className="bar-value">{value.toFixed(1).replace(".", ",")}</span><div className="bar" style={{ height: `${32 + ((max - value) / (max - min)) * 58}%` }} /><small>{index % 2 ? "" : `${index + 1}/7`}</small></div>)}
        </div>
      </section>
      <div className="content-grid">
        <section className="panel badges-panel"><div className="panel-heading"><div><span className="eyebrow neutral">Conquistas</span><h3>Suas medalhas</h3></div><Trophy /></div><div className="badges"><Badge emoji="🌱" title="Primeiro passo" text="Primeiro registro" earned /><Badge emoji="💧" title="Hidratada" text="Meta de água 3x" earned /><Badge emoji="🔥" title="Em movimento" text="5 dias seguidos" earned /><Badge emoji="⭐" title="Semana perfeita" text="Todas as metas" /></div></section>
        <section className="panel consistency-panel"><div className="panel-heading"><div><span className="eyebrow neutral">Consistência</span><h3>Metas concluídas</h3></div><Target /></div>{goals.map((goal) => <div className="consistency-row" key={goal.label}><span>{goal.label}</span><strong>{Math.round((goal.value / goal.goal) * 100)}%</strong><div className="mini-progress"><span style={{ width: `${(goal.value / goal.goal) * 100}%` }} /></div></div>)}</section>
      </div>
    </div>
  );
}

function Badge({ emoji, title, text, earned = false }: { emoji: string; title: string; text: string; earned?: boolean }) {
  return <div className={`badge ${earned ? "earned" : ""}`}><span>{emoji}</span><div><strong>{title}</strong><small>{text}</small></div>{earned && <Check />}</div>;
}

function ProfileView({ profile, setProfile, waterGoal, setWaterGoal, onSave, onLogout }: {
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  waterGoal: number;
  setWaterGoal: (value: number) => void;
  onSave: () => void;
  onLogout: () => void;
}) {
  const equipment = ["Halteres", "Puxador", "Leg press", "Bicicleta", "Transport", "Elásticos"];
  const bmi = calculateBmi(profile.weightKg, profile.heightCm);
  return (
    <div className="page">
      <div className="page-heading"><div><span className="eyebrow neutral">Personalização</span><h1>Seu perfil</h1><p>Esses dados deixam os cálculos e treinos mais adequados para você.</p></div><button className="logout-button" onClick={onLogout}><LogOut /> Sair</button></div>
      <div className="profile-layout">
        <section className="panel profile-card">
          <div className="profile-avatar">{profile.name.slice(0, 1)}</div>
          <h2>{profile.name}</h2><p>{calculateAge(profile.birthDate)} anos • {profile.heightCm} cm</p>
          <div className="profile-bmi"><span>IMC atual</span><strong>{bmi.toFixed(1).replace(".", ",")}</strong><small>{bmiLabel(bmi)}</small></div>
        </section>
        <section className="panel profile-form">
          <div className="form-section"><div className="section-title"><UserRound /><div><h3>Dados pessoais</h3><p>Usados para estimativas individuais.</p></div></div><div className="form-grid">
            <label className="field"><span>Como quer ser chamada?</span><input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
            <label className="field"><span>Data de nascimento</span><input type="date" value={profile.birthDate} onChange={(event) => setProfile({ ...profile, birthDate: event.target.value })} /></label>
            <label className="field"><span>Altura (cm)</span><input type="number" value={profile.heightCm} onChange={(event) => setProfile({ ...profile, heightCm: Number(event.target.value) })} /></label>
            <label className="field"><span>Peso atual (kg)</span><input type="number" step="0.1" value={profile.weightKg} onChange={(event) => setProfile({ ...profile, weightKg: Number(event.target.value) })} /></label>
            <label className="field"><span>Meta de peso (kg)</span><input type="number" step="0.1" value={profile.goalWeightKg} onChange={(event) => setProfile({ ...profile, goalWeightKg: Number(event.target.value) })} /></label>
            <label className="field"><span>Atividade atual</span><select value={profile.activityLevel} onChange={(event) => setProfile({ ...profile, activityLevel: event.target.value as Profile["activityLevel"] })}><option value="low">Sedentária</option><option value="light">Levemente ativa</option><option value="moderate">Moderadamente ativa</option><option value="high">Muito ativa</option></select></label>
          </div></div>
          <div className="form-section"><div className="section-title"><Dumbbell /><div><h3>Equipamentos disponíveis</h3><p>O plano inteligente usará somente o que você marcar.</p></div></div><div className="equipment-options">{equipment.map((item) => <button key={item} className={profile.equipment.includes(item) ? "selected" : ""} onClick={() => setProfile({ ...profile, equipment: profile.equipment.includes(item) ? profile.equipment.filter((equipmentItem) => equipmentItem !== item) : [...profile.equipment, item] })}>{profile.equipment.includes(item) && <Check />}{item}</button>)}</div></div>
          <div className="form-section"><div className="section-title"><Settings2 /><div><h3>Metas e cuidados</h3><p>Você pode ajustar quando quiser.</p></div></div><div className="form-grid">
            <label className="field"><span>Meta diária de água (ml)</span><input type="number" step="250" value={waterGoal} onChange={(event) => setWaterGoal(Number(event.target.value))} /></label>
            <label className="field wide"><span>Limitações ou observações</span><textarea value={profile.limitations} onChange={(event) => setProfile({ ...profile, limitations: event.target.value })} placeholder="Ex.: dor no joelho, baixa resistência..." /></label>
          </div></div>
          <button className="primary-button save-profile" onClick={onSave}>Salvar alterações <Check /></button>
        </section>
      </div>
    </div>
  );
}

function MealModal({ onClose, onSave }: { onClose: () => void; onSave: (meal: Meal) => void }) {
  const [name, setName] = useState("");
  const [grams, setGrams] = useState("");
  const [protein, setProtein] = useState(0);
  const [calories, setCalories] = useState(0);
  const estimate = useMemo(
    () => estimateNutrition(name, grams ? Number(grams) : undefined),
    [name, grams],
  );

  useEffect(() => {
    setProtein(estimate?.protein ?? 0);
    setCalories(estimate?.calories ?? 0);
  }, [estimate]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-heading"><div><span className="modal-icon"><Utensils /></span><div><span className="eyebrow neutral">Diário alimentar</span><h2>Adicionar refeição</h2></div></div><button onClick={onClose} aria-label="Fechar"><X /></button></div>
        <p>Descreva do seu jeito. O Evolua estima os nutrientes e informa a porção considerada; você só ajusta se precisar.</p>
        <label className="field"><span>O que você comeu?</span><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: frango grelhado pequeno" /></label>
        <label className="field optional-grams"><span>Peso aproximado (opcional)</span><div className="input-suffix"><input type="number" min="1" value={grams} onChange={(event) => setGrams(event.target.value)} placeholder="Se souber" /><b>g</b></div></label>
        {name && estimate ? (
          <div className="nutrition-estimate">
            <div className="estimate-heading"><Sparkles /><div><strong>Estimativa nutricional</strong><span>{estimate.servingLabel}</span></div><small>confiança {estimate.confidence}</small></div>
            <div className="estimate-values"><div><strong>{protein} g</strong><span>Proteína</span></div><div><strong>{calories} kcal</strong><span>Calorias</span></div></div>
            <p>Identificado: {estimate.matchedFoods.join(", ")}. Os valores são aproximados e podem variar pelo preparo.</p>
          </div>
        ) : name ? (
          <div className="estimate-empty">Não reconheci esse alimento ainda. Informe os valores abaixo para salvar e melhorar o registro.</div>
        ) : null}
        <details className="manual-nutrition" open={Boolean(name && !estimate)}>
          <summary>Ajustar valores manualmente</summary>
          <div className="form-grid"><label className="field"><span>Proteína (g)</span><input type="number" min="0" value={protein} onChange={(event) => setProtein(Number(event.target.value))} /></label><label className="field"><span>Calorias (kcal)</span><input type="number" min="0" value={calories} onChange={(event) => setCalories(Number(event.target.value))} /></label></div>
        </details>
        <div className="modal-actions"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={!name || (!estimate && protein === 0 && calories === 0)} onClick={() => onSave({ id: crypto.randomUUID(), name, protein, calories, time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) })}>Adicionar <Plus /></button></div>
      </div>
    </div>
  );
}

function NavButton({ tab, active, onClick }: { tab: Tab; active: boolean; onClick: (tab: Tab) => void }) {
  const config = {
    hoje: { icon: Home, label: "Hoje" },
    treino: { icon: Dumbbell, label: "Treino" },
    progresso: { icon: BarChart3, label: "Progresso" },
    perfil: { icon: CircleUserRound, label: "Perfil" },
  };
  const Icon = config[tab].icon;
  return <button className={active ? "active" : ""} onClick={() => onClick(tab)}><Icon /><span>{config[tab].label}</span>{active && <ChevronRight className="desktop-chevron" />}</button>;
}

export default App;
