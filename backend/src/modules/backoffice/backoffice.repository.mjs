import supabase from '../../integrations/supabase/supabase.client.mjs';

const normalizeStaff = (row) => {
  if (!row) return null;
  return { ...row, role: row.staff_roles || row.role || null, team: row.teams || row.team || null };
};

export const backofficeRepository = {
  async findStaffByEmail(email) {
    const { data, error } = await supabase.from('staff_users').select('id,name,email,password_hash,status,team_id,role_id,last_login_at,staff_roles(id,key,name),teams(id,name)').ilike('email', String(email || '').trim()).maybeSingle();
    if (error) throw error;
    return normalizeStaff(data);
  },
  async findStaffById(id) {
    const { data, error } = await supabase.from('staff_users').select('id,name,email,status,team_id,role_id,last_login_at,staff_roles(id,key,name),teams(id,name)').eq('id', id).maybeSingle();
    if (error) throw error;
    return normalizeStaff(data);
  },
  async permissionsForRole(roleId) {
    const { data, error } = await supabase.from('role_permissions').select('data_scope,permissions(key)').eq('role_id', roleId);
    if (error) throw error;
    return (data || []).filter(item => item.permissions?.key).map(item => ({ key: item.permissions.key, scope: item.data_scope || 'ALL' }));
  },
  async touchLastLogin(id) {
    const { error } = await supabase.from('staff_users').update({ last_login_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
  },
  async listStaff() {
    const { data, error } = await supabase.from('staff_users').select('id,name,email,status,team_id,role_id,last_login_at,created_at,staff_roles(id,key,name),teams(id,name)').order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []).map(normalizeStaff);
  },
  async listRoles() {
    const { data, error } = await supabase.from('staff_roles').select('id,key,name,description').order('name');
    if (error) throw error;
    return data || [];
  },
  async listTeams() {
    const { data, error } = await supabase.from('teams').select('id,name,status').order('name');
    if (error) throw error;
    return data || [];
  },
  async createStaff(payload) {
    const { data, error } = await supabase.from('staff_users').insert(payload).select('id').single();
    if (error) throw error;
    return data;
  },
  async updateStaff(id, payload) {
    const { data, error } = await supabase.from('staff_users').update(payload).eq('id', id).select('id').single();
    if (error) throw error;
    return data;
  }
};

export default backofficeRepository;
