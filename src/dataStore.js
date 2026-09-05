import { supabase } from "./supabaseClient";

/**
 * This app keeps the exact same in-memory `data` shape that the original
 * prototype used (children/events/periods/pin/settings/location/...).
 * On every change the whole state is re-synced to Supabase (delete + insert
 * per table, in FK-safe order). Given the tiny data volume for a family app
 * (a handful of children, ~20-30 tasks each, a few events), this is simpler
 * and far less bug-prone than diff-based incremental updates, at a
 * negligible performance cost.
 */

export async function loadFromSupabase() {
  const [settingsRes, periodsRes, childrenRes, tasksRes, eventsRes, violationsRes] = await Promise.all([
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("periods").select("*").order("sort_order"),
    supabase.from("children").select("*").order("sort_order"),
    supabase.from("tasks").select("*").order("sort_order"),
    supabase.from("events").select("*"),
    supabase.from("violations").select("*"),
  ]);

  const errors = [settingsRes, periodsRes, childrenRes, tasksRes, eventsRes, violationsRes]
    .map((r) => r.error)
    .filter(Boolean);
  if (errors.length > 0) throw errors[0];

  const settingsRow = settingsRes.data;
  const periodsRows = periodsRes.data || [];
  const childrenRows = childrenRes.data || [];
  const tasksRows = tasksRes.data || [];
  const eventsRows = eventsRes.data || [];
  const violationsRows = violationsRes.data || [];

  const tasksByChild = {};
  tasksRows.forEach((t) => {
    if (!tasksByChild[t.child_id]) tasksByChild[t.child_id] = [];
    tasksByChild[t.child_id].push({
      id: t.id,
      time: t.period_key,
      label: t.label,
      emoji: t.emoji,
      why: t.why || "",
      active: t.active,
      needsPhoto: t.needs_photo,
      custom: t.custom,
      done: t.done,
      doneAt: t.done_at,
      earnedPoints: t.earned_points,
      photo: t.photo,
    });
  });

  const violationsByChild = {};
  violationsRows.forEach((v) => {
    if (!violationsByChild[v.child_id]) violationsByChild[v.child_id] = [];
    violationsByChild[v.child_id].push({
      id: v.id,
      note: v.note,
      points: v.points,
      date: v.violation_date,
      resolved: v.resolved,
      refund: v.refund,
    });
  });

  const children = childrenRows.map((c) => ({
    id: c.id,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
    points: c.points,
    weeklyPoints: c.weekly_points,
    weeklyGoal: c.weekly_goal,
    weeklyReward: c.weekly_reward,
    rewardClaimed: c.reward_claimed,
    streak: c.streak,
    bestStreak: c.best_streak,
    totalPoints: c.total_points,
    bonusTaskId: c.bonus_task_id,
    history: c.history || {},
    tasks: tasksByChild[c.id] || [],
    violations: (violationsByChild[c.id] || []).sort((a, b) => b.date.localeCompare(a.date)),
  }));

  const periods = periodsRows.map((p) => ({
    key: p.key,
    label: p.label,
    emoji: p.emoji,
    color: p.color,
    start: p.start_time,
    end: p.end_time,
  }));

  const events = eventsRows.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.event_date,
    time: e.event_time || "",
    who: e.who,
    reminderMinutes: e.reminder_minutes,
    notified: e.notified,
  }));

  return {
    children,
    events,
    periods,
    pin: settingsRow ? settingsRow.pin : "1234",
    settings: {
      leaderboardEnabled: settingsRow ? settingsRow.leaderboard_enabled : true,
      familyName: settingsRow ? settingsRow.family_name || "" : "",
    },
    location: settingsRow && settingsRow.lat != null && settingsRow.lon != null
      ? { lat: settingsRow.lat, lon: settingsRow.lon }
      : null,
    lastActiveDate: settingsRow ? settingsRow.last_active_date : null,
    weekStart: settingsRow ? settingsRow.week_start_date : null,
  };
}

export async function saveToSupabase(data) {
  // 1. app_settings (single row, upsert)
  const { error: settingsErr } = await supabase.from("app_settings").upsert({
    id: 1,
    pin: data.pin,
    leaderboard_enabled: data.settings.leaderboardEnabled,
    family_name: data.settings.familyName || "",
    lat: data.location ? data.location.lat : null,
    lon: data.location ? data.location.lon : null,
    last_active_date: data.lastActiveDate,
    week_start_date: data.weekStart,
  });
  if (settingsErr) throw settingsErr;

  // 2. periods (full replace)
  const { error: delPeriodsErr } = await supabase.from("periods").delete().not("key", "is", null);
  if (delPeriodsErr) throw delPeriodsErr;
  if (data.periods.length > 0) {
    const { error: insPeriodsErr } = await supabase.from("periods").insert(
      data.periods.map((p, i) => ({
        key: p.key,
        label: p.label,
        emoji: p.emoji,
        color: p.color,
        start_time: p.start,
        end_time: p.end,
        sort_order: i,
      }))
    );
    if (insPeriodsErr) throw insPeriodsErr;
  }

  // 3. children (full replace) — must exist before tasks/violations (FK).
  // tasks/violations reference children.id, so they must be cleared first,
  // otherwise deleting children fails with a foreign key violation.
  const { error: delViolationsErr } = await supabase.from("violations").delete().not("id", "is", null);
  if (delViolationsErr) throw delViolationsErr;
  const { error: delTasksErr } = await supabase.from("tasks").delete().not("id", "is", null);
  if (delTasksErr) throw delTasksErr;
  const { error: delChildrenErr } = await supabase.from("children").delete().not("id", "is", null);
  if (delChildrenErr) throw delChildrenErr;
  if (data.children.length > 0) {
    const { error: insChildrenErr } = await supabase.from("children").insert(
      data.children.map((c, i) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        color: c.color,
        points: c.points,
        weekly_points: c.weeklyPoints,
        weekly_goal: c.weeklyGoal,
        weekly_reward: c.weeklyReward,
        reward_claimed: c.rewardClaimed,
        streak: c.streak,
        best_streak: c.bestStreak,
        total_points: c.totalPoints,
        bonus_task_id: c.bonusTaskId,
        history: c.history || {},
        sort_order: i,
      }))
    );
    if (insChildrenErr) throw insChildrenErr;
  }

  // 4. tasks (full replace, after children)
  const allTasks = data.children.flatMap((c) =>
    c.tasks.map((t, i) => ({
      id: t.id,
      child_id: c.id,
      period_key: t.time,
      label: t.label,
      emoji: t.emoji,
      why: t.why || "",
      active: t.active !== false,
      needs_photo: !!t.needsPhoto,
      custom: !!t.custom,
      sort_order: i,
      done: !!t.done,
      done_at: t.doneAt || null,
      earned_points: t.earnedPoints || 0,
      photo: t.photo || null,
    }))
  );
  if (allTasks.length > 0) {
    const { error: insTasksErr } = await supabase.from("tasks").insert(allTasks);
    if (insTasksErr) throw insTasksErr;
  }

  // 5. events (full replace)
  const { error: delEventsErr } = await supabase.from("events").delete().not("id", "is", null);
  if (delEventsErr) throw delEventsErr;
  if (data.events.length > 0) {
    const { error: insEventsErr } = await supabase.from("events").insert(
      data.events.map((e) => ({
        id: e.id,
        title: e.title,
        event_date: e.date,
        event_time: e.time || null,
        who: e.who,
        reminder_minutes: e.reminderMinutes || 0,
        notified: !!e.notified,
      }))
    );
    if (insEventsErr) throw insEventsErr;
  }

  // 6. violations (full replace, after children)
  const allViolations = data.children.flatMap((c) =>
    (c.violations || []).map((v) => ({
      id: v.id,
      child_id: c.id,
      note: v.note,
      points: v.points,
      violation_date: v.date,
      resolved: !!v.resolved,
      refund: v.refund || 0,
    }))
  );
  if (allViolations.length > 0) {
    const { error: insViolationsErr } = await supabase.from("violations").insert(allViolations);
    if (insViolationsErr) throw insViolationsErr;
  }
}
