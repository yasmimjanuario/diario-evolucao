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
  LockKeyhole,
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
  understandEquipment,
} from "./lib/health";
import { addMeal, loadUserData, saveProfile, saveWater, saveWeight } from "./lib/store";
import { estimateNutrition, getFoodSuggestions } from "./lib/nutrition";
import { searchPublicFoods, type PublicFoodSuggestion } from "./lib/foodApi";
import type { Exercise, Meal, Profile, Tab, WeightLog, WorkoutSession } from "./types";

const emptyProfile: Profile = {
  name: "",
  birthDate: "",
  sex: "female",
  heightCm: 0,
  weightKg: 0,
  goalWeightKg: 0,
  activityLevel: "low",
  equipment: [],
  limitations: "",
  waterGoalMl: 2000,
  proteinGoalG: 100,
  weeklyExerciseMinutes: 150,
  onboardingCompleted: false,
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
  const [recoveringPassword, setRecoveringPassword] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [tab, setTab] = useState<Tab>("hoje");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [water, setWater] = useState(0);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [weightHistory, setWeightHistory] = useState<WeightLog[]>([]);
  const [showWeight, setShowWeight] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workout, setWorkout] = useState<WorkoutSession>({
    startedAt: null,
    elapsedSeconds: 0,
    running: false,
  });
  const [showMeal, setShowMeal] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingAuth(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setRecoveringPassword(true);
      setLoadingAuth(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user.id) {
      setProfile(emptyProfile);
      setWater(0);
      setMeals([]);
      setWeightHistory([]);
      setExercises([]);
      return;
    }
    let active = true;
    setLoadingData(true);
    setDataError("");
    loadUserData(session.user.id)
      .then((data) => {
        if (!active) return;
        const nextProfile = data.profile ?? {
          ...emptyProfile,
          name: session.user.email?.split("@")[0] ?? "",
        };
        setProfile(nextProfile);
        setWater(data.water);
        setMeals(data.meals);
        setWeightHistory(data.weights);
        setExercises(nextProfile.onboardingCompleted ? generateWorkout(nextProfile) : []);
      })
      .catch((error: Error) => active && setDataError(error.message))
      .finally(() => active && setLoadingData(false));
    return () => { active = false; };
  }, [session?.user.id]);

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
  const proteinGoal = profile.proteinGoalG;
  const completedExercises = exercises.filter((exercise) => exercise.completed).length;
  const workoutMet = exercises.length
    ? exercises.reduce((total, exercise) => total + exercise.met, 0) / exercises.length
    : 4;
  const caloriesBurned = calorieBurn(workoutMet, profile.weightKg, workout.elapsedSeconds);
  const weeklyGoals = [
    { label: `${profile.weeklyExerciseMinutes} min de exercício`, value: Math.round(workout.elapsedSeconds / 60), goal: profile.weeklyExerciseMinutes, icon: Dumbbell },
    { label: "Bater a meta de água", value: water >= profile.waterGoalMl ? 1 : 0, goal: 7, icon: Droplets },
    { label: "Registrar alimentação", value: meals.length ? 1 : 0, goal: 7, icon: Apple },
  ];

  if (loadingAuth) return <Splash />;
  if (!session) return <AuthScreen />;
  if (recoveringPassword) return <ResetPasswordScreen onDone={() => setRecoveringPassword(false)} />;
  if (loadingData) return <Splash />;
  if (dataError) return <DataError message={dataError} onLogout={() => void supabase.auth.signOut()} />;
  if (!profile.onboardingCompleted) {
    return (
      <Onboarding
        profile={profile}
        setProfile={setProfile}
        onSave={async () => {
          if (!userId) return;
          const completedProfile = { ...profile, onboardingCompleted: true };
          await Promise.all([saveProfile(userId, completedProfile), saveWeight(userId, completedProfile.weightKg)]);
          setProfile(completedProfile);
          setWeightHistory([{ weight: completedProfile.weightKg, date: new Date().toISOString() }]);
          setExercises(generateWorkout(completedProfile));
        }}
        onLogout={() => void supabase.auth.signOut()}
      />
    );
  }

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
            <button className="avatar" onClick={() => setTab("perfil")} aria-label="Abrir perfil">
              {profile.name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>

        {tab === "hoje" && (
          <TodayView
            profile={profile}
            bmi={bmi}
            water={water}
            waterGoal={profile.waterGoalMl}
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

        {tab === "progresso" && <ProgressView profile={profile} bmi={bmi} goals={weeklyGoals} weights={weightHistory} onAddWeight={() => setShowWeight(true)} />}

        {tab === "perfil" && (
          <ProfileView
            profile={profile}
            setProfile={setProfile}
            onSave={async () => {
              if (userId) {
                await Promise.all([saveProfile(userId, profile), saveWeight(userId, profile.weightKg)]);
                setWeightHistory((current) => [...current, { weight: profile.weightKg, date: new Date().toISOString() }]);
              }
              regenerateWorkout();
            }}
            onLogout={() => void supabase.auth.signOut()}
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
      {showWeight && (
        <WeightModal
          currentWeight={profile.weightKg}
          onClose={() => setShowWeight(false)}
          onSave={async (weight) => {
            if (!userId) return;
            const data = await saveWeight(userId, weight);
            const logged = { id: data.id, weight: Number(data.weight_kg), date: data.logged_at };
            setWeightHistory((current) => [...current, logged].sort((a, b) => a.date.localeCompare(b.date)));
            setProfile((current) => ({ ...current, weightKg: weight }));
            await saveProfile(userId, { ...profile, weightKg: weight });
            setShowWeight(false);
          }}
        />
      )}
    </div>
  );
}

function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const savePassword = async () => {
    if (password.length < 6 || password !== confirmation) return;
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (authError) setError(authError.message);
    else onDone();
  };

  return (
    <div className="auth-page">
      <section className="auth-visual"><Brand /><div className="auth-copy"><h1>Uma nova senha, sua jornada <em>preservada.</em></h1></div></section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void savePassword(); }}>
          <div className="mobile-auth-brand"><Brand /></div>
          <span className="eyebrow neutral">Recuperação de acesso</span>
          <h2>Crie uma nova senha</h2>
          <p>Seus registros e seu progresso continuarão na mesma conta.</p>
          <label className="field"><span>Nova senha</span><div className="input-with-icon"><LockKeyhole size={18} /><input type="password" minLength={6} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div></label>
          <label className="field"><span>Confirme a nova senha</span><div className="input-with-icon"><LockKeyhole size={18} /><input type="password" minLength={6} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></div></label>
          <button className="primary-button" disabled={loading || password.length < 6 || password !== confirmation}>{loading ? "Salvando..." : "Salvar nova senha"} <ArrowRight size={18} /></button>
          {confirmation && password !== confirmation && <p className="form-error">As senhas não coincidem.</p>}
          {error && <p className="form-error">{error}</p>}
        </form>
      </section>
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

function AuthScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submitAuth = async () => {
    if (!email || (mode !== "forgot" && password.length < 6)) return;
    setError("");
    setMessage("");
    if (!supabaseConfigured) {
      setError("O acesso ainda não foi configurado. As variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY estão ausentes no deploy.");
      return;
    }
    setLoading(true);
    if (mode === "forgot") {
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (authError) setError(authError.message);
      else setMessage("Enviamos um link para você criar uma nova senha.");
    } else if (mode === "signup") {
      const { data, error: authError } = await supabase.auth.signUp({ email, password });
      if (authError) setError(authError.message);
      else if (data.session) setMessage("Conta criada com sucesso.");
      else setMessage("Conta criada. Confirme seu e-mail para entrar.");
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) setError(authError.message === "Invalid login credentials" ? "E-mail ou senha incorretos." : authError.message);
    }
    setLoading(false);
  };

  const changeMode = (nextMode: "login" | "signup" | "forgot") => {
    setMode(nextMode);
    setError("");
    setMessage("");
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
        <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void submitAuth(); }}>
          <div className="mobile-auth-brand"><Brand /></div>
          <span className="eyebrow neutral">Bem-vinda ao Evolua</span>
          <h2>{mode === "signup" ? "Crie sua conta" : mode === "forgot" ? "Recupere sua senha" : "Entre no seu diário"}</h2>
          <p>{mode === "signup" ? "Comece sua jornada com seus dados protegidos." : mode === "forgot" ? "Informe seu e-mail para definir uma nova senha." : "Use seu e-mail e senha para continuar."}</p>
          <label className="field">
            <span>Seu e-mail</span>
            <div className="input-with-icon"><Mail size={18} /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></div>
          </label>
          {mode !== "forgot" && (
            <label className="field">
              <span>Senha</span>
              <div className="input-with-icon"><LockKeyhole size={18} /><input type="password" minLength={6} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" /></div>
            </label>
          )}
          <button type="submit" className="primary-button" disabled={loading || !email || (mode !== "forgot" && password.length < 6)}>
            {loading ? "Aguarde..." : mode === "signup" ? "Criar conta" : mode === "forgot" ? "Enviar recuperação" : "Entrar"} <ArrowRight size={18} />
          </button>
          {message && <div className="success-message"><Mail /><div><strong>{message}</strong></div></div>}
          {error && <p className="form-error">{error}</p>}
          <div className="auth-actions">
            {mode === "login" && <button type="button" className="text-button" onClick={() => changeMode("forgot")}>Esqueci minha senha</button>}
            <button type="button" className="text-button" onClick={() => changeMode(mode === "signup" ? "login" : mode === "login" ? "signup" : "login")}>
              {mode === "signup" ? "Já tenho conta" : mode === "login" ? "Criar uma conta" : "Voltar para o login"}
            </button>
          </div>
          <small className="privacy-copy">Ao entrar, você concorda com os termos e a política de privacidade. Seus dados de saúde ficam protegidos.</small>
        </form>
      </section>
    </div>
  );
}

function DataError({ message, onLogout }: { message: string; onLogout: () => void }) {
  return (
    <div className="splash error-state">
      <strong>Não foi possível carregar seus dados.</strong>
      <small>{message}</small>
      <button className="secondary-button" onClick={() => window.location.reload()}>Tentar novamente</button>
      <button className="text-button" onClick={onLogout}>Sair</button>
    </div>
  );
}

function Onboarding({ profile, setProfile, onSave, onLogout }: {
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  onSave: () => Promise<void>;
  onLogout: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const valid = Boolean(
    profile.name.trim() &&
    profile.birthDate &&
    profile.heightCm > 0 &&
    profile.weightKg > 0 &&
    profile.goalWeightKg > 0 &&
    profile.waterGoalMl > 0 &&
    profile.proteinGoalG > 0 &&
    profile.weeklyExerciseMinutes > 0
  );
  return (
    <div className="onboarding-shell">
      <header><Brand /><button className="logout-button" onClick={onLogout}><LogOut /> Sair</button></header>
      <div className="onboarding-copy">
        <span className="eyebrow neutral">Primeiro acesso</span>
        <h1>Vamos configurar seu diário</h1>
        <p>Preencha seus dados e metas para liberar o painel. Nada será preenchido com informações de exemplo.</p>
      </div>
      <ProfileView
        profile={profile}
        setProfile={setProfile}
        onboarding
        onLogout={onLogout}
        onSave={async () => {
          if (!valid || saving) return;
          setSaving(true);
          setError("");
          try {
            await onSave();
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar o cadastro.");
          } finally {
            setSaving(false);
          }
        }}
      />
      {!valid && <p className="onboarding-warning">Preencha todos os campos obrigatórios para continuar.</p>}
      {error && <p className="form-error onboarding-warning">{error}</p>}
      {saving && <p className="onboarding-warning">Salvando seu cadastro…</p>}
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
        <div className="streak"><Flame /><div><strong>0 dias</strong><span>de sequência</span></div></div>
      </div>

      <section className="hero-progress">
        <div>
          <span className="soft-label"><Target size={15} /> Rumo à sua meta</span>
          <h2>{props.profile.weightKg.toFixed(1).replace(".", ",")} <small>kg</small></h2>
          <p>Faltam <strong>{remaining.toFixed(1).replace(".", ",")} kg</strong> para sua meta de {props.profile.goalWeightKg} kg</p>
        </div>
        <div className="weight-journey">
          <div className="journey-labels"><span>Início <strong>{props.profile.weightKg.toFixed(1).replace(".", ",")} kg</strong></span><span>Meta <strong>{props.profile.goalWeightKg} kg</strong></span></div>
          <div className="progress-track"><span style={{ width: "0%" }} /></div>
          <p><TrendingDown size={15} /> Seu ponto de partida foi registrado.</p>
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
          <div className="next-medal"><Trophy /><div><span>Próxima medalha</span><strong>Primeiro passo</strong></div><span>0 metas</span></div>
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

function ProgressView({ profile, bmi, goals, weights, onAddWeight }: {
  profile: Profile;
  bmi: number;
  goals: { label: string; value: number; goal: number; icon: typeof Dumbbell }[];
  weights: WeightLog[];
  onAddWeight: () => void;
}) {
  const visibleWeights = weights.slice(-8);
  const values = visibleWeights.map((item) => item.weight);
  const first = weights[0]?.weight ?? profile.weightKg;
  const change = profile.weightKg - first;
  const max = values.length ? Math.max(...values) : 1;
  const min = values.length ? Math.min(...values) - 1 : 0;
  return (
    <div className="page">
      <div className="page-heading"><div><span className="eyebrow neutral">Sua jornada</span><h1>Progresso</h1><p>Registre seu peso semanalmente ou sempre que quiser.</p></div><button className="primary-button" onClick={onAddWeight}><Plus /> Registrar peso</button></div>
      <div className="progress-stats">
        <div><Scale /><span>Peso atual</span><strong>{profile.weightKg.toFixed(1).replace(".", ",")} kg</strong><small>{change === 0 ? "Ponto de partida" : `${change > 0 ? "+" : ""}${change.toFixed(1).replace(".", ",")} kg desde o início`}</small></div>
        <div><Gauge /><span>IMC</span><strong>{bmi.toFixed(1).replace(".", ",")}</strong><small>{bmiLabel(bmi)}</small></div>
        <div><Dumbbell /><span>Treinos</span><strong>0</strong><small>Nenhum concluído</small></div>
        <div><Flame /><span>Sequência</span><strong>0 dias</strong><small>Comece hoje</small></div>
      </div>
      <section className="panel chart-panel">
        <div className="panel-heading"><div><span className="eyebrow neutral">Evolução do peso</span><h3>Histórico das suas pesagens</h3></div><span className="positive-chip"><Scale /> {weights.length} registro{weights.length === 1 ? "" : "s"}</span></div>
        {visibleWeights.length ? <div className="bar-chart">
          {visibleWeights.map((item, index) => <div key={item.id ?? `${item.date}-${index}`} className="bar-wrap"><span className="bar-value">{item.weight.toFixed(1).replace(".", ",")}</span><div className="bar" style={{ height: `${32 + ((max - item.weight) / Math.max(max - min, 1)) * 58}%` }} /><small>{new Date(item.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</small></div>)}
        </div> : <div className="empty-chart">Sua primeira pesagem aparecerá aqui.</div>}
      </section>
      <div className="content-grid">
        <section className="panel badges-panel"><div className="panel-heading"><div><span className="eyebrow neutral">Conquistas</span><h3>Suas medalhas</h3></div><Trophy /></div><div className="badges"><Badge emoji="🌱" title="Primeiro passo" text="Primeiro registro" earned={weights.length > 0} /><Badge emoji="💧" title="Hidratada" text="Meta de água 3x" /><Badge emoji="🔥" title="Em movimento" text="5 dias seguidos" /><Badge emoji="⭐" title="Semana perfeita" text="Todas as metas" /></div></section>
        <section className="panel consistency-panel"><div className="panel-heading"><div><span className="eyebrow neutral">Consistência</span><h3>Metas concluídas</h3></div><Target /></div>{goals.map((goal) => <div className="consistency-row" key={goal.label}><span>{goal.label}</span><strong>{Math.round((goal.value / goal.goal) * 100)}%</strong><div className="mini-progress"><span style={{ width: `${(goal.value / goal.goal) * 100}%` }} /></div></div>)}</section>
      </div>
    </div>
  );
}

function Badge({ emoji, title, text, earned = false }: { emoji: string; title: string; text: string; earned?: boolean }) {
  return <div className={`badge ${earned ? "earned" : ""}`}><span>{emoji}</span><div><strong>{title}</strong><small>{text}</small></div>{earned && <Check />}</div>;
}

function ProfileView({ profile, setProfile, onSave, onLogout, onboarding = false }: {
  profile: Profile;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  onSave: () => Promise<void> | void;
  onLogout: () => void;
  onboarding?: boolean;
}) {
  const equipment = ["Halteres", "Puxador", "Leg press", "Bicicleta", "Transport", "Elásticos"];
  const [customEquipment, setCustomEquipment] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState("");
  const bmi = calculateBmi(profile.weightKg, profile.heightCm);
  const addCustomEquipment = () => {
    const understood = understandEquipment(customEquipment);
    if (!understood || profile.equipment.some((item) => item.toLocaleLowerCase() === understood.toLocaleLowerCase())) return;
    setProfile({ ...profile, equipment: [...profile.equipment, understood] });
    setCustomEquipment("");
  };
  return (
    <div className="page">
      {!onboarding && <div className="page-heading"><div><span className="eyebrow neutral">Personalização</span><h1>Seu perfil</h1><p>Esses dados deixam os cálculos e treinos mais adequados para você.</p></div><button className="logout-button" onClick={onLogout}><LogOut /> Sair</button></div>}
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
          <div className="form-section"><div className="section-title"><Dumbbell /><div><h3>Equipamentos disponíveis</h3><p>Marque os mais comuns ou escreva como você conhece. A IA identifica nomes equivalentes e adapta o treino.</p></div></div>
            <div className="equipment-options">{equipment.map((item) => <button type="button" key={item} className={profile.equipment.includes(item) ? "selected" : ""} onClick={() => setProfile({ ...profile, equipment: profile.equipment.includes(item) ? profile.equipment.filter((equipmentItem) => equipmentItem !== item) : [...profile.equipment, item] })}>{profile.equipment.includes(item) && <Check />}{item}</button>)}</div>
            <div className="equipment-entry"><div className="input-suffix"><input value={customEquipment} onChange={(event) => setCustomEquipment(event.target.value)} onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), addCustomEquipment())} placeholder="Ex.: cadeira extensora, air walker, máquina de peito..." /><button type="button" onClick={addCustomEquipment}><Plus /> Adicionar</button></div></div>
            <div className="equipment-tags">{profile.equipment.filter((item) => !equipment.includes(item)).map((item) => <span key={item}>{item}<button type="button" aria-label={`Remover ${item}`} onClick={() => setProfile({ ...profile, equipment: profile.equipment.filter((current) => current !== item) })}><X /></button></span>)}</div>
          </div>
          <div className="form-section"><div className="section-title"><Settings2 /><div><h3>Metas e cuidados</h3><p>Você pode ajustar quando quiser.</p></div></div><div className="form-grid">
            <label className="field"><span>Meta diária de água (ml)</span><input type="number" min="250" step="250" value={profile.waterGoalMl} onChange={(event) => setProfile({ ...profile, waterGoalMl: Number(event.target.value) })} /></label>
            <label className="field"><span>Meta diária de proteína (g)</span><input type="number" min="10" step="5" value={profile.proteinGoalG} onChange={(event) => setProfile({ ...profile, proteinGoalG: Number(event.target.value) })} /></label>
            <label className="field"><span>Exercício por semana (min)</span><input type="number" min="10" step="10" value={profile.weeklyExerciseMinutes} onChange={(event) => setProfile({ ...profile, weeklyExerciseMinutes: Number(event.target.value) })} /></label>
            <label className="field"><span>Meta de peso (kg)</span><input type="number" min="20" step="0.1" value={profile.goalWeightKg} onChange={(event) => setProfile({ ...profile, goalWeightKg: Number(event.target.value) })} /></label>
            <label className="field wide"><span>Limitações ou observações</span><textarea value={profile.limitations} onChange={(event) => setProfile({ ...profile, limitations: event.target.value })} placeholder="Ex.: dor no joelho, baixa resistência..." /></label>
          </div></div>
          <button className="primary-button save-profile" disabled={saveStatus === "saving"} onClick={async () => {
            setSaveStatus("saving");
            setSaveError("");
            try {
              await onSave();
              setSaveStatus("saved");
              window.setTimeout(() => setSaveStatus("idle"), 2500);
            } catch (error) {
              setSaveError(error instanceof Error ? error.message : "Não foi possível salvar.");
              setSaveStatus("error");
            }
          }}>{saveStatus === "saving" ? "Salvando…" : saveStatus === "saved" ? "Alterações salvas" : "Salvar alterações"} <Check /></button>
          {saveStatus === "error" && <p className="form-error profile-save-error">{saveError}</p>}
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
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [publicSuggestions, setPublicSuggestions] = useState<PublicFoodSuggestion[]>([]);
  const [searchingFoods, setSearchingFoods] = useState(false);
  const [selectedPublicFood, setSelectedPublicFood] = useState<PublicFoodSuggestion | null>(null);
  const estimate = useMemo(
    () => estimateNutrition(name, grams ? Number(grams) : undefined),
    [name, grams],
  );
  const suggestions = useMemo(() => getFoodSuggestions(name), [name]);

  useEffect(() => {
    if (selectedPublicFood) {
      const portion = grams ? Number(grams) : selectedPublicFood.servingGrams;
      setProtein(Math.round((selectedPublicFood.protein100g * portion) / 100));
      setCalories(Math.round((selectedPublicFood.calories100g * portion) / 100));
    } else {
      setProtein(estimate?.protein ?? 0);
      setCalories(estimate?.calories ?? 0);
    }
  }, [estimate, grams, selectedPublicFood]);

  useEffect(() => {
    if (!showSuggestions || selectedPublicFood || name.trim().length < 3) {
      setPublicSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearchingFoods(true);
      searchPublicFoods(name, controller.signal)
        .then(setPublicSuggestions)
        .catch((error) => {
          if (error instanceof Error && error.name !== "AbortError") setPublicSuggestions([]);
        })
        .finally(() => setSearchingFoods(false));
    }, 900);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [name, selectedPublicFood, showSuggestions]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-heading"><div><span className="modal-icon"><Utensils /></span><div><span className="eyebrow neutral">Diário alimentar</span><h2>Adicionar refeição</h2></div></div><button onClick={onClose} aria-label="Fechar"><X /></button></div>
        <p>Descreva do seu jeito. O Evolua estima os nutrientes e informa a porção considerada; você só ajusta se precisar.</p>
        <label className="field food-search"><span>O que você comeu?</span><input autoFocus autoComplete="off" value={name} onFocus={() => setShowSuggestions(true)} onChange={(event) => { setName(event.target.value); setSelectedPublicFood(null); setShowSuggestions(true); }} placeholder="Ex.: leite integral, frango grelhado..." />
          {showSuggestions && (searchingFoods || publicSuggestions.length > 0 || suggestions.length > 0) && <div className="food-suggestions">
            {searchingFoods && <div className="food-searching">Buscando na base nutricional…</div>}
            {publicSuggestions.map((suggestion) => <button type="button" key={suggestion.id} onClick={() => { setName(suggestion.label); setGrams(String(suggestion.servingGrams)); setSelectedPublicFood(suggestion); setShowSuggestions(false); }}>
              <span>{suggestion.label}<em>{suggestion.brand}</em></span><small>{suggestion.calories100g} kcal • {suggestion.protein100g} g proteína / 100 g</small>
            </button>)}
            {!searchingFoods && publicSuggestions.length === 0 && suggestions.map((suggestion) => <button type="button" key={`${suggestion.description}-${suggestion.grams}`} onClick={() => { setName(suggestion.description); setGrams(String(suggestion.grams)); setShowSuggestions(false); }}>
              <span>{suggestion.label}<em>Estimativa do Evolua</em></span><small>aprox. {suggestion.grams} g</small>
            </button>)}
          </div>}
        </label>
        <label className="field optional-grams"><span>Peso aproximado (opcional)</span><div className="input-suffix"><input type="number" min="1" value={grams} onChange={(event) => setGrams(event.target.value)} placeholder="Se souber" /><b>g</b></div></label>
        {name && (estimate || selectedPublicFood) ? (
          <div className="nutrition-estimate">
            <div className="estimate-heading"><Sparkles /><div><strong>Estimativa nutricional</strong><span>{selectedPublicFood ? `${grams || selectedPublicFood.servingGrams} g • ${selectedPublicFood.brand}` : estimate?.servingLabel}</span></div><small>{selectedPublicFood ? "Open Food Facts" : `confiança ${estimate?.confidence}`}</small></div>
            <div className="estimate-values"><div><strong>{protein} g</strong><span>Proteína</span></div><div><strong>{calories} kcal</strong><span>Calorias</span></div></div>
            <p>{selectedPublicFood ? "Dados públicos do rótulo do produto selecionado." : `Identificado: ${estimate?.matchedFoods.join(", ")}. Os valores são aproximados e podem variar pelo preparo.`}</p>
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

function WeightModal({ currentWeight, onClose, onSave }: {
  currentWeight: number;
  onClose: () => void;
  onSave: (weight: number) => Promise<void>;
}) {
  const [weight, setWeight] = useState(String(currentWeight || ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const value = Number(weight);
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="modal weight-modal" onSubmit={async (event) => {
        event.preventDefault();
        if (value <= 0 || saving) return;
        setSaving(true);
        setError("");
        try {
          await onSave(value);
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Não foi possível registrar o peso.");
          setSaving(false);
        }
      }}>
        <div className="modal-heading"><div><span className="modal-icon"><Scale /></span><div><span className="eyebrow neutral">Nova pesagem</span><h2>Registrar peso</h2></div></div><button type="button" onClick={onClose} aria-label="Fechar"><X /></button></div>
        <p>Você pode registrar quando quiser. Cada pesagem fica salva com data e horário.</p>
        <label className="field"><span>Peso atual (kg)</span><input autoFocus type="number" min="20" max="500" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} /></label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={value <= 0 || saving}>{saving ? "Salvando…" : "Registrar"} <Check /></button></div>
      </form>
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
