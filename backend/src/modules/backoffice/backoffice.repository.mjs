import supabase from '../../integrations/supabase/supabase.client.mjs';
const normalizeStaff=row=>row?{...row,role:row.staff_roles||row.role||null,team:row.teams||row.team||null}:null;
export const backofficeRepository={
async findStaffByEmail(email){const{data,error}=await supabase.from('staff_users').select('id,name,email,password_hash,status,team_id,role_id,last_login_at,staff_roles(id,key,name),teams(id,name)').ilike('email',String(email||'').trim()).maybeSingle();if(error)throw error;return normalizeStaff(data);},
async findStaffById(id){const{data,error}=await supabase.from('staff_users').select('id,name,email,status,team_id,role_id,last_login_at,staff_roles(id,key,name),teams(id,name)').eq('id',id).maybeSingle();if(error)throw error;return normalizeStaff(data);},
async permissionsForRole(roleId){const{data,error}=await supabase.from('role_permissions').select('data_scope,permissions(key)').eq('role_id',roleId);if(error)throw error;return(data||[]).filter(x=>x.permissions?.key).map(x=>({key:x.permissions.key,scope:x.data_scope||'ALL'}));},
async touchLastLogin(id){const{error}=await supabase.from('staff_users').update({last_login_at:new Date().toISOString()}).eq('id',id);if(error)throw error;},
async listStaff(){const{data,error}=await supabase.from('staff_users').select('id,name,email,status,team_id,role_id,last_login_at,created_at,staff_roles(id,key,name),teams(id,name)').order('created_at',{ascending:true});if(error)throw error;return(data||[]).map(normalizeStaff);},
async listRoles(){const{data,error}=await supabase.from('staff_roles').select('id,key,name,description').order('name');if(error)throw error;return data||[];},
async listTeams(){const{data,error}=await supabase.from('teams').select('id,name,status').order('name');if(error)throw error;return data||[];},
async createStaff(payload){const{data,error}=await supabase.from('staff_users').insert(payload).select('id').single();if(error)throw error;return data;},
async updateStaff(id,payload){const{data,error}=await supabase.from('staff_users').update(payload).eq('id',id).select('id').single();if(error)throw error;return data;},
async bookingInScope(identifier,profile,scope){let q=supabase.from('bookings').select('id,confirmation_code,assigned_agent_id,team_id');if(String(identifier).includes('-'))q=q.eq('confirmation_code',identifier);else q=q.eq('id',identifier);if(scope==='OWN')q=q.eq('assigned_agent_id',profile.id||'__none__');if(scope==='TEAM')q=q.eq('team_id',profile.team?.id||'__none__');const{data,error}=await q.maybeSingle();if(error)throw error;return data;}
};
export default backofficeRepository;
