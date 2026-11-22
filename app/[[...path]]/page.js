
'use client';

import { useEffect, useState, useCallback } from 'react';
import { createAuthClient } from 'better-auth/react';
import { jwtClient } from 'better-auth/client/plugins';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const auth = createAuthClient({
  plugins: [jwtClient()],
});

const base =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

async function api(path, method = 'GET', body) {
  const token = await auth.token().catch(() => null);

  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + (token?.data?.token || ''),
    },
    cache: 'no-store',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong');
  }

  return data;
}

export default function Page() {
  const path = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState(null);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);

  const { data: session, isPending } = auth.useSession();

  const dashboard =
    '/dashboard/' + (profile?.role || 'Student').toLowerCase();

  const isDashboard = path.startsWith('/dashboard');
  const isDetails = path.startsWith('/tuitions/');
  const isProfile = path === '/dashboard/profile';

  const showMessage = (text) => {
    setMessage(text);
  };

  const run = async (action, successText = 'Success') => {
    try {
      setMessage('');
      await action();
      setMessage(successText);
    } catch (error) {
      setMessage(error.message || 'Something went wrong');
    }
  };

  const loadProfile = useCallback(async () => {
    if (!session) {
      setProfile(null);
      return;
    }

    try {
      const data = await api('/profile');
      setProfile(data);
    } catch (error) {
      console.error('Profile error:', error);
    }
  }, [session]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      let endpoint = '/tuitions';

      if (path.startsWith('/tuitions/')) {
        endpoint = path;
      } else if (path === '/dashboard/tutor') {
        endpoint = '/mine';
      } else if (
        path.includes('/applications') ||
        path === '/dashboard/student'
      ) {
        endpoint = '/applications';
      } else if (path.includes('/payments')) {
        endpoint = '/payments';
      } else if (path.startsWith('/dashboard/admin')) {
        endpoint =
          '/admin/' + (path.split('/')[3] || 'tuitions');
      }

      const data = await api(endpoint);

      setItems(Array.isArray(data) ? data : data ? [data] : []);
    } catch (error) {
      setItems([]);
      setMessage(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    setSearch('');
    setPage(1);

    if (isDashboard && (isPending || !session)) {
      setItems([]);
      setLoading(false);
      return;
    }

    load();
  }, [path, session, isPending, isDashboard, load]);

  useEffect(() => {
    if (path !== '/payment/success' || !session) return;

    const sessionId =
      new URLSearchParams(window.location.search).get('session_id');

    if (!sessionId) {
      setMessage('Payment session ID not found');
      return;
    }

    run(
      () => api('/payment/verify', 'POST', { sessionId }),
      'Payment verified successfully'
    );
  }, [path, session]);

  const form = (fields, action, label, initial = {}) => (
    <form
      onSubmit={async (event) => {
        event.preventDefault();

        const data = Object.fromEntries(
          new FormData(event.currentTarget)
        );

        await run(() => action(data), label + ' successful');
      }}
    >
      {fields.map((field) => (
        <label key={field}>
          {field}

          <input
            name={field}
            defaultValue={initial[field] || ''}
            required={!['note', 'photo'].includes(field)}
            type={
              field === 'password'
                ? 'password'
                : field === 'email'
                ? 'email'
                : 'text'
            }
          />
        </label>
      ))}

      <button type="submit">{label}</button>
    </form>
  );

  const filteredItems = items.filter((item) =>
    JSON.stringify(item)
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const visibleItems = filteredItems.slice(
    (page - 1) * 6,
    page * 6
  );

  const refresh = async () => {
    await load();
  };

  const applyForTuition = async (data) => {
    if (!session) {
      router.push('/sign-in');
      return;
    }

    if (!items[0]?._id) {
      throw new Error('Tuition not found');
    }

    await api('/applications', 'POST', {
      ...data,
      tuitionId: items[0]._id,
    });

    router.push(dashboard + '/applications');
  };

  return (
    <div className={dark ? 'dark' : ''}>
      <header>
        <Link href="/" className="logo">
          Mentor<span>Lagbe</span>
        </Link>

        <nav>
          <Link href="/">Home</Link>
          <Link href="/tuitions">Tuitions</Link>
          <Link href="/pricing">Pricing</Link>

          {session ? (
            <>
              <Link href={dashboard}>Dashboard</Link>

              <button
                onClick={async () => {
                  await auth.signOut();
                  router.push('/');
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <Link href="/sign-in">Sign in</Link>
          )}

          <button onClick={() => setDark(!dark)}>
            ◐
          </button>
        </nav>
      </header>

      <main>
        {message && (
          <aside onClick={() => setMessage('')}>
            {message}
          </aside>
        )}

        {path === '/' && (
          <section className="hero">
            <small>LEARN • CONNECT • GROW</small>

            <h1>
              Better learning starts
              <br />
              with the right mentor.
            </h1>

            <p>
              Discover tuition opportunities and build your
              future with MentorLagbe.
            </p>

            <Link className="button" href="/tuitions">
              Explore tuitions
            </Link>
          </section>
        )}

        {['/sign-in', '/sign-up'].includes(path) && (
          <section>
            <h1>
              {path === '/sign-up'
                ? 'Create account'
                : 'Welcome back'}
            </h1>

            {form(
              path === '/sign-up'
                ? ['name', 'email', 'password', 'role']
                : ['email', 'password'],
              async (data) => {
                const result =
                  path === '/sign-up'
                    ? await auth.signUp.email(data)
                    : await auth.signIn.email(data);

                if (result.error) {
                  throw new Error(result.error.message);
                }

                if (path === '/sign-up') {
                  await api('/profile', 'POST', data);
                }

                window.location.href = '/dashboard/profile';
              },
              'Continue'
            )}

            <Link
              href={
                path === '/sign-up'
                  ? '/sign-in'
                  : '/sign-up'
              }
            >
              Switch account form
            </Link>
          </section>
        )}

        {path === '/pricing' && (
          <section>
            <h1>Upgrade your potential</h1>

            <div className="cards">
              {['Student', 'Tutor'].map((role) => (
                <article key={role}>
                  <h2>{role} Pro</h2>

                  <h1>
                    ${role === 'Tutor' ? 15 : 10}
                  </h1>

                  <p>
                    {role === 'Tutor'
                      ? 'Unlimited tuition posts'
                      : 'Student Pro membership'}
                  </p>

                  <button
                    onClick={() =>
                      run(async () => {
                        if (!session) {
                          router.push('/sign-in');
                          return;
                        }

                        const data = await api(
                          '/checkout',
                          'POST',
                          {}
                        );

                        if (data.url) {
                          window.location.href = data.url;
                        } else {
                          throw new Error(
                            'Checkout URL not found'
                          );
                        }
                      })
                    }
                  >
                    Upgrade
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {isDashboard && (
          <>
            <h1>
              Dashboard · {profile?.role || 'Student'}
            </h1>

            <nav>
              <Link href={dashboard}>Overview</Link>

              <Link href="/dashboard/profile">
                Profile
              </Link>

              <Link href={dashboard + '/applications'}>
                Applications
              </Link>

              <Link href="/dashboard/payments">
                Payments
              </Link>

              {profile?.role === 'Admin' &&
                ['users', 'tuitions', 'payments'].map(
                  (key) => (
                    <Link
                      key={key}
                      href={'/dashboard/admin/' + key}
                    >
                      {key}
                    </Link>
                  )
                )}
            </nav>

            {!session && !isPending && (
              <Link href="/sign-in">
                Please sign in
              </Link>
            )}

            {isProfile &&
              session &&
              form(
                ['name', 'photo', 'role'],
                async (data) => {
                  const result = await api(
                    '/profile',
                    'POST',
                    data
                  );

                  setProfile(result);
                },
                'Save profile',
                profile || {}
              )}

            {path === '/dashboard/tutor' &&
              session && (
                <>
                  <h2>Post tuition</h2>

                  {form(
                    [
                      'title',
                      'subject',
                      'location',
                      'salary',
                      'description',
                    ],
                    async (data) => {
                      await api(
                        '/tuitions',
                        'POST',
                        data
                      );

                      await refresh();
                    },
                    'Create tuition'
                  )}
                </>
              )}
          </>
        )}

        {isDetails && (
          <section>
            {loading ? (
              <p>Loading tuition details...</p>
            ) : items[0]?._id ? (
              <>
                <h1>{items[0].title}</h1>

                <p>{items[0].description}</p>

                <p>
                  {items[0].subject} •{' '}
                  {items[0].location} • ৳
                  {items[0].salary}
                </p>

                <h2>Apply for this tuition</h2>

                {session ? (
                  form(
                    ['phone', 'schedule', 'note'],
                    applyForTuition,
                    'Apply now'
                  )
                ) : (
                  <Link href="/sign-in">
                    Sign in to apply
                  </Link>
                )}
              </>
            ) : (
              <p>Tuition not found.</p>
            )}
          </section>
        )}

        {(path === '/' ||
          path === '/tuitions' ||
          (isDashboard && !isProfile)) && (
          <section>
            <h2>
              {isDashboard
                ? 'Records'
                : 'Available tuitions'}
            </h2>

            <input
              placeholder="Search by subject or location"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />

            {loading && <p>Loading...</p>}

            {!loading && filteredItems.length === 0 && (
              <p>No records found.</p>
            )}

            <div className="cards">
              {visibleItems.map((item, index) => (
                <article
                  key={item._id || index}
                >
                  <small>
                    {item.subject ||
                      item.status ||
                      item.role}
                  </small>

                  <h3>
                    {item.title ||
                      item.name ||
                      item.email}
                  </h3>

                  <p>
                    {item.location ||
                      item.phone ||
                      item.email}
                  </p>

                  <p>
                    {item.salary
                      ? '৳' + item.salary
                      : item.status || item.plan}
                  </p>

                  {!isDashboard ? (
                    <Link
                      href={
                        '/tuitions/' + item._id
                      }
                    >
                      View details
                    </Link>
                  ) : (
                    <>
                      {profile?.role === 'Admin' &&
                        item.title &&
                        ['approved', 'rejected'].map(
                          (status) => (
                            <button
                              key={status}
                              onClick={() =>
                                run(async () => {
                                  await api(
                                    '/admin/tuitions/' +
                                      item._id,
                                    'PATCH',
                                    { status }
                                  );

                                  await refresh();
                                })
                              }
                            >
                              {status}
                            </button>
                          )
                        )}

                      {profile?.role === 'Tutor' &&
                        item.tuitionId &&
                        ['accepted', 'rejected'].map(
                          (status) => (
                            <button
                              key={status}
                              onClick={() =>
                                run(async () => {
                                  await api(
                                    '/applications/' +
                                      item._id,
                                    'PATCH',
                                    { status }
                                  );

                                  await refresh();
                                })
                              }
                            >
                              {status}
                            </button>
                          )
                        )}

                      {profile?.role === 'Tutor' &&
                        !item.tuitionId &&
                        item.title && (
                          <>
                            <button
                              onClick={() =>
                                run(async () => {
                                  await api(
                                    '/tuitions/' +
                                      item._id,
                                    'PATCH',
                                    {
                                      active:
                                        !item.active,
                                    }
                                  );

                                  await refresh();
                                })
                              }
                            >
                              Toggle active
                            </button>

                            <button
                              onClick={() =>
                                run(async () => {
                                  await api(
                                    '/tuitions/' +
                                      item._id,
                                    'DELETE'
                                  );

                                  await refresh();
                                })
                              }
                            >
                              Delete
                            </button>

                            <details>
                              <summary>Edit</summary>

                              {form(
                                [
                                  'title',
                                  'subject',
                                  'location',
                                  'salary',
                                  'description',
                                ],
                                async (data) => {
                                  await api(
                                    '/tuitions/' +
                                      item._id,
                                    'PATCH',
                                    data
                                  );

                                  await refresh();
                                },
                                'Save',
                                item
                              )}
                            </details>
                          </>
                        )}

                      {profile?.role === 'Student' &&
                        item.tuitionId && (
                          <button
                            onClick={() =>
                              run(async () => {
                                await api(
                                  '/applications/' +
                                    item._id,
                                  'DELETE'
                                );

                                await refresh();
                              })
                            }
                          >
                            Cancel
                          </button>
                        )}
                    </>
                  )}
                </article>
              ))}
            </div>

            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>

            {' '}

            <button
              disabled={
                page * 6 >= filteredItems.length
              }
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </section>
        )}

        {path.startsWith('/payment/') && (
          <h1>
            {path.endsWith('cancel')
              ? 'Payment cancelled'
              : 'Payment verification'}
          </h1>
        )}
      </main>

      <footer>
        MentorLagbe © 2026 · Learning without limits
      </footer>
    </div>
  );
}
