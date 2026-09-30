import React, { useState } from 'react';
import { AuthUser } from '../types';

interface ProfilePageProps {
  user: AuthUser;
  onLogout: () => void;
  onUpdate: (user: AuthUser) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ user, onLogout, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: user.name,
    department: user.department || '',
    year: user.year || '',
    semester: user.semester || '',
    rollNumber: user.rollNumber || '',
    subject: user.subject || '',
    employeeId: user.employeeId || '',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = () => {
    const updated: AuthUser = {
      ...user,
      name: form.name,
      department: form.department || undefined,
      year: form.year || undefined,
      semester: form.semester || undefined,
      rollNumber: form.rollNumber || undefined,
      subject: form.subject || undefined,
      employeeId: form.employeeId || undefined,
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(form.name)}&background=003527&color=80bea6&size=128&bold=true`,
    };
    localStorage.setItem('campusiq_user', JSON.stringify(updated));
    onUpdate(updated);
    setEditing(false);
  };

  return (
    <div className="w-full min-h-screen bg-[#f4f7ff] pt-[64px] pb-20">
      <div className="max-w-[900px] w-full mx-auto px-4 md:px-6">

        {/* Page heading */}
        <div className="pt-10 pb-8">
          <h1 className="font-headline text-2xl md:text-[2rem] font-extrabold text-[#0b1c30]">
            My Profile
          </h1>
          <p className="text-sm text-[#5a6672] mt-1">
            Manage your account information and preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Left — Avatar card */}
          <div className="md:col-span-1">
            <div className="card p-6 flex flex-col items-center text-center gap-4">
              <div className="relative">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-24 h-24 rounded-full border-4 border-[#b0f0d6] object-cover shadow-md"
                />
                <span className={`absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px]
                                  font-bold uppercase tracking-wider
                                  ${user.role === 'admin'
                                    ? 'bg-[#fea619] text-[#684000]'
                                    : user.role === 'teacher'
                                    ? 'bg-[#dbeafe] text-[#1d4ed8]'
                                    : 'bg-[#b0f0d6] text-[#003527]'}`}>
                  {user.role}
                </span>
              </div>

              <div>
                <h2 className="font-headline font-bold text-lg text-[#0b1c30]">{user.name}</h2>
                <p className="text-xs text-[#9ca8a3] mt-0.5">{user.email}</p>
              </div>

              {user.role === 'student' && (
                <div className="w-full space-y-2 text-xs border-t border-[#f0f4ff] pt-4">
                  {[
                    { icon: 'school',        label: 'Roll No',     value: user.rollNumber },
                    { icon: 'apartment',     label: 'Department',  value: user.department },
                    { icon: 'calendar_today',label: 'Year',        value: user.year       },
                    { icon: 'book_2',        label: 'Semester',    value: user.semester   },
                    { icon: 'smartphone',    label: 'Mobile',      value: user.phone      },
                  ].map((item) => item.value ? (
                    <div key={item.label} className="flex items-center gap-2 text-[#5a6672]">
                      <span className="material-symbols-outlined text-[15px] text-[#003527]">
                        {item.icon}
                      </span>
                      <span className="font-medium">{item.label}:</span>
                      <span className="font-bold text-[#0b1c30]">{item.value}</span>
                    </div>
                  ) : null)}
                </div>
              )}

              {user.role === 'teacher' && (
                <div className="w-full space-y-2 text-xs border-t border-[#f0f4ff] pt-4">
                  {[
                    { icon: 'auto_stories',  label: 'Subject',     value: user.subject    },
                    { icon: 'apartment',     label: 'Department',  value: user.department },
                    { icon: 'badge',         label: 'Employee ID', value: user.employeeId },
                    { icon: 'smartphone',    label: 'Mobile',      value: user.phone      },
                  ].map((item) => item.value ? (
                    <div key={item.label} className="flex items-center gap-2 text-[#5a6672]">
                      <span className="material-symbols-outlined text-[15px] text-[#2563eb]">
                        {item.icon}
                      </span>
                      <span className="font-medium">{item.label}:</span>
                      <span className="font-bold text-[#0b1c30]">{item.value}</span>
                    </div>
                  ) : null)}
                </div>
              )}

              {/* Logout */}
              <button
                onClick={onLogout}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                           rounded-xl border-2 border-red-100 text-red-500 hover:bg-red-50
                           text-xs font-bold transition-all mt-2"
              >
                <span className="material-symbols-outlined text-[17px]">logout</span>
                Sign Out
              </button>
            </div>
          </div>

          {/* Right — Details form */}
          <div className="md:col-span-2 flex flex-col gap-5">

            {/* Account Info */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-headline font-bold text-base text-[#0b1c30]">
                  Account Information
                </h3>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="btn btn-secondary text-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(false)}
                      className="btn btn-ghost text-xs text-[#9ca8a3]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      className="btn btn-primary text-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">save</span>
                      Save
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                    Full Name
                  </label>
                  {editing ? (
                    <input
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                 text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]
                                 focus:ring-1 focus:ring-[#003527]/20"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-[#0b1c30]">{user.name}</p>
                  )}
                </div>

                {/* Email (readonly) */}
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                    Email Address
                  </label>
                  <p className="text-sm font-semibold text-[#0b1c30]">{user.email || '—'}</p>
                  <p className="text-[10px] text-[#9ca8a3] mt-0.5">Cannot be changed</p>
                </div>

                {/* Phone (readonly) */}
                {user.phone && (
                  <div>
                    <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                      Mobile Number
                    </label>
                    <p className="text-sm font-semibold text-[#0b1c30]">{user.phone}</p>
                    <p className="text-[10px] text-[#9ca8a3] mt-0.5">Used for sign-in</p>
                  </div>
                )}

                {/* Role */}
                <div>
                  <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                    Role
                  </label>
                  <span className={`badge text-[10px]
                                    ${user.role === 'admin' ? 'badge-secondary' : user.role === 'teacher' ? 'bg-[#dbeafe] text-[#1d4ed8]' : 'badge-primary'}`}>
                    {user.role === 'admin' ? 'Administrator' : user.role === 'teacher' ? 'Teacher' : 'Student'}
                  </span>
                </div>

                {/* Student-specific fields */}
                {user.role === 'student' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                        Roll Number
                      </label>
                      {editing ? (
                        <input
                          value={form.rollNumber}
                          onChange={(e) => set('rollNumber', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                     text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]
                                     focus:ring-1 focus:ring-[#003527]/20"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-[#0b1c30]">{user.rollNumber || '—'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                        Department
                      </label>
                      {editing ? (
                        <input
                          value={form.department}
                          onChange={(e) => set('department', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                     text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]
                                     focus:ring-1 focus:ring-[#003527]/20"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-[#0b1c30]">{user.department || '—'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                        Year
                      </label>
                      {editing ? (
                        <select
                          value={form.year}
                          onChange={(e) => set('year', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                     text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                        >
                          <option value="">Select</option>
                          {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm font-semibold text-[#0b1c30]">{user.year || '—'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                        Semester
                      </label>
                      {editing ? (
                        <select
                          value={form.semester}
                          onChange={(e) => set('semester', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                     text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]"
                        >
                          <option value="">Select</option>
                          {[1,2,3,4,5,6,7,8].map((s) => (
                            <option key={s} value={`Semester ${s}`}>Semester {s}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="text-sm font-semibold text-[#0b1c30]">{user.semester || '—'}</p>
                      )}
                    </div>
                  </>
                )}

                {/* Teacher-specific fields */}
                {user.role === 'teacher' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                        Subject / Course
                      </label>
                      {editing ? (
                        <input
                          value={form.subject}
                          onChange={(e) => set('subject', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                     text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]
                                     focus:ring-1 focus:ring-[#003527]/20"
                          placeholder="e.g. Data Structures"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-[#0b1c30]">{user.subject || '—'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                        Department
                      </label>
                      {editing ? (
                        <input
                          value={form.department}
                          onChange={(e) => set('department', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                     text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]
                                     focus:ring-1 focus:ring-[#003527]/20"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-[#0b1c30]">{user.department || '—'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#9ca8a3] uppercase tracking-wide mb-1.5">
                        Employee ID
                      </label>
                      {editing ? (
                        <input
                          value={form.employeeId}
                          onChange={(e) => set('employeeId', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#bfc9c3]/40 bg-[#f8fafe]
                                     text-sm text-[#0b1c30] focus:outline-none focus:border-[#003527]
                                     focus:ring-1 focus:ring-[#003527]/20"
                        />
                      ) : (
                        <p className="text-sm font-semibold text-[#0b1c30]">{user.employeeId || '—'}</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Security card */}
            <div className="card p-6">
              <h3 className="font-headline font-bold text-base text-[#0b1c30] mb-4">Security</h3>
              <div className="flex items-center justify-between py-3 border-b border-[#f0f4ff]">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px] text-[#003527]">lock</span>
                  <div>
                    <p className="text-sm font-semibold text-[#0b1c30]">Password</p>
                    <p className="text-xs text-[#9ca8a3]">Last changed: Never</p>
                  </div>
                </div>
                <button className="text-xs font-bold text-[#003527] hover:underline">
                  Change
                </button>
              </div>
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px] text-[#003527]">devices</span>
                  <div>
                    <p className="text-sm font-semibold text-[#0b1c30]">Active Sessions</p>
                    <p className="text-xs text-[#9ca8a3]">1 device — This browser</p>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="text-xs font-bold text-red-500 hover:underline"
                >
                  Sign out all
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
