'use client'

import { useState, useEffect } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

interface AuthFormData {
  email: string
  password: string
}

interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: 'reader' | 'editor' | 'admin'
  created_at: string
  updated_at: string
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  priority: number
  created_at: string
}

interface Article {
  id: string
  title: string
  slug: string
  content: string | null
  excerpt: string | null
  featured_image: string | null
  category_id: string | null
  author_id: string | null
  status: 'draft' | 'review' | 'published' | 'archived'
  language: 'en' | 'ar'
  ai_generated: boolean
  published_at: string | null
  created_at: string
  updated_at: string
  categories?: Category
  profiles?: Profile
}

interface Tag {
  id: string
  name: string
  slug: string
  created_at: string
}

interface Comment {
  id: string
  article_id: string
  author_id: string | null
  content: string
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  profiles?: Profile
}

interface ArticleAnalytics {
  id: string
  article_id: string
  views: number
  shares: number
  date: string
}

interface AuthError {
  message: string
}

type TabType = 'overview' | 'profile' | 'articles' | 'categories' | 'tags' | 'comments' | 'analytics'

export default function AuthPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: ''
  })
  const [error, setError] = useState<AuthError | null>(null)
  const [message, setMessage] = useState<string>('')
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  
  // Database state
  const [profile, setProfile] = useState<Profile | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [comments, setComments] = useState<Comment[]>([])
  const [analytics, setAnalytics] = useState<ArticleAnalytics[]>([])
  const [dataLoading, setDataLoading] = useState(false)

  // Check auth state on component mount and listen for changes
  useEffect(() => {
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadUserData(session.user.id)
        }
      } catch (error) {
        console.error('Error getting session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
        
        if (event === 'SIGNED_OUT') {
          setMessage('Successfully logged out')
          setProfile(null)
          setCategories([])
          setArticles([])
          setTags([])
          setComments([])
          setAnalytics([])
        } else if (event === 'SIGNED_IN' && session?.user) {
          setMessage('Successfully logged in')
          await loadUserData(session.user.id)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (userId: string) => {
    setDataLoading(true)
    try {
      // Load or create profile
      let { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (profileError && profileError.code === 'PGRST116') {
        // Profile doesn't exist, create it
        const { data: userData } = await supabase.auth.getUser()
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert([
            {
              id: userId,
              email: userData.user?.email || '',
              full_name: userData.user?.user_metadata?.full_name || null,
              role: 'reader'
            }
          ])
          .select()
          .single()

        if (createError) {
          console.error('Error creating profile:', createError)
        } else {
          profileData = newProfile
        }
      }

      setProfile(profileData)
      await loadAllData()
    } catch (error) {
      console.error('Error loading user data:', error)
    } finally {
      setDataLoading(false)
    }
  }

  const loadAllData = async () => {
    try {
      // Load categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .order('priority', { ascending: true })

      setCategories(categoriesData || [])

      // Load articles with relations
      const { data: articlesData } = await supabase
        .from('articles')
        .select(`
          *,
          categories(name, slug),
          profiles(full_name, email)
        `)
        .order('created_at', { ascending: false })

      setArticles(articlesData || [])

      // Load tags
      const { data: tagsData } = await supabase
        .from('tags')
        .select('*')
        .order('name', { ascending: true })

      setTags(tagsData || [])

      // Load comments with author info
      const { data: commentsData } = await supabase
        .from('comments')
        .select(`
          *,
          profiles(full_name, email)
        `)
        .order('created_at', { ascending: false })

      setComments(commentsData || [])

      // Load analytics
      const { data: analyticsData } = await supabase
        .from('article_analytics')
        .select('*')
        .order('date', { ascending: false })

      setAnalytics(analyticsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    if (error) setError(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setAuthLoading(true)
    setError(null)
    setMessage('')

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password
        })
        if (error) throw error
        setMessage('Check your email for the confirmation link!')
      }
    } catch (error: any) {
      setError({ message: error.message || 'An error occurred' })
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      setAuthLoading(true)
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      setFormData({ email: '', password: '' })
    } catch (error: any) {
      setError({ message: error.message || 'Error logging out' })
    } finally {
      setAuthLoading(false)
    }
  }

  const toggleAuthMode = () => {
    setIsLogin(!isLogin)
    setError(null)
    setMessage('')
  }

  const testDatabaseOperations = async () => {
    if (!user || !profile) return

    try {
      setDataLoading(true)
      
      // Test creating a sample article
      const { data: newArticle, error: articleError } = await supabase
        .from('articles')
        .insert([
          {
            title: 'Test Article',
            slug: `test-article-${Date.now()}`,
            content: 'This is a test article content.',
            excerpt: 'Test excerpt',
            author_id: user.id,
            category_id: categories[0]?.id || null,
            status: 'draft',
            language: 'en'
          }
        ])
        .select()
        .single()

      if (articleError) throw articleError

      // Test creating a sample comment
      if (newArticle) {
        const { error: commentError } = await supabase
          .from('comments')
          .insert([
            {
              article_id: newArticle.id,
              author_id: user.id,
              content: 'This is a test comment.',
              status: 'pending'
            }
          ])

        if (commentError) throw commentError
      }

      // Test creating analytics entry
      if (newArticle) {
        const { error: analyticsError } = await supabase
          .from('article_analytics')
          .insert([
            {
              article_id: newArticle.id,
              views: 1,
              shares: 0,
              date: new Date().toISOString().split('T')[0]
            }
          ])

        if (analyticsError) throw analyticsError
      }

      setMessage('Test operations completed successfully!')
      await loadAllData()
    } catch (error: any) {
      setError({ message: error.message || 'Error testing database operations' })
    } finally {
      setDataLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {user ? (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Database Testing Dashboard</h1>
                  <p className="text-gray-600">Logged in as: {user.email}</p>
                  {profile && (
                    <p className="text-sm text-gray-500">
                      Role: {profile.role} | Profile ID: {profile.id}
                    </p>
                  )}
                </div>
                <div className="flex space-x-4">
                  <button
                    onClick={testDatabaseOperations}
                    disabled={dataLoading}
                    className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    {dataLoading ? 'Testing...' : 'Test DB Operations'}
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={authLoading}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {authLoading ? 'Logging out...' : 'Logout'}
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            {message && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800">{message}</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-800">{error.message}</p>
              </div>
            )}

            {/* Navigation Tabs */}
            <div className="bg-white rounded-lg shadow-md">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6" aria-label="Tabs">
                  {[
                    { id: 'overview', name: 'Overview' },
                    { id: 'profile', name: 'Profile' },
                    { id: 'articles', name: `Articles (${articles.length})` },
                    { id: 'categories', name: `Categories (${categories.length})` },
                    { id: 'tags', name: `Tags (${tags.length})` },
                    { id: 'comments', name: `Comments (${comments.length})` },
                    { id: 'analytics', name: `Analytics (${analytics.length})` }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.name}
                    </button>
                  ))}
                </nav>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900">Articles</h3>
                      <p className="text-2xl font-bold text-blue-600">{articles.length}</p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-green-900">Categories</h3>
                      <p className="text-2xl font-bold text-green-600">{categories.length}</p>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-purple-900">Tags</h3>
                      <p className="text-2xl font-bold text-purple-600">{tags.length}</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-orange-900">Comments</h3>
                      <p className="text-2xl font-bold text-orange-600">{comments.length}</p>
                    </div>
                  </div>
                )}

                {activeTab === 'profile' && profile && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold mb-4">Profile Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p><strong>ID:</strong> {profile.id}</p>
                        <p><strong>Email:</strong> {profile.email}</p>
                        <p><strong>Full Name:</strong> {profile.full_name || 'Not set'}</p>
                      </div>
                      <div>
                        <p><strong>Role:</strong> {profile.role}</p>
                        <p><strong>Created:</strong> {new Date(profile.created_at).toLocaleString()}</p>
                        <p><strong>Updated:</strong> {new Date(profile.updated_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'articles' && (
                  <div className="space-y-4">
                    {articles.length === 0 ? (
                      <p className="text-gray-500">No articles found.</p>
                    ) : (
                      articles.map((article) => (
                        <div key={article.id} className="border rounded-lg p-4">
                          <h4 className="font-semibold">{article.title}</h4>
                          <p className="text-sm text-gray-600">
                            Status: {article.status} | Language: {article.language} | 
                            AI Generated: {article.ai_generated ? 'Yes' : 'No'}
                          </p>
                          <p className="text-sm text-gray-500">
                            Category: {article.categories?.name || 'None'} | 
                            Author: {article.profiles?.full_name || article.profiles?.email || 'Unknown'}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'categories' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {categories.map((category) => (
                      <div key={category.id} className="border rounded-lg p-4">
                        <h4 className="font-semibold">{category.name}</h4>
                        <p className="text-sm text-gray-600">Slug: {category.slug}</p>
                        <p className="text-sm text-gray-600">Priority: {category.priority}</p>
                        <p className="text-sm text-gray-500">{category.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'tags' && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {tags.length === 0 ? (
                      <p className="text-gray-500">No tags found.</p>
                    ) : (
                      tags.map((tag) => (
                        <div key={tag.id} className="border rounded-lg p-4">
                          <h4 className="font-semibold">{tag.name}</h4>
                          <p className="text-sm text-gray-600">Slug: {tag.slug}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div className="space-y-4">
                    {comments.length === 0 ? (
                      <p className="text-gray-500">No comments found.</p>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="border rounded-lg p-4">
                          <p className="text-sm text-gray-600">
                            Status: {comment.status} | 
                            Author: {comment.profiles?.full_name || comment.profiles?.email || 'Unknown'}
                          </p>
                          <p className="mt-2">{comment.content}</p>
                          <p className="text-xs text-gray-500 mt-2">
                            {new Date(comment.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'analytics' && (
                  <div className="space-y-4">
                    {analytics.length === 0 ? (
                      <p className="text-gray-500">No analytics data found.</p>
                    ) : (
                      analytics.map((analytic) => (
                        <div key={analytic.id} className="border rounded-lg p-4">
                          <p className="text-sm text-gray-600">
                            Article ID: {analytic.article_id}
                          </p>
                          <p className="text-sm">
                            Views: {analytic.views} | Shares: {analytic.shares}
                          </p>
                          <p className="text-xs text-gray-500">Date: {analytic.date}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Login/Register form (unchanged)
          <div className="max-w-md mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-md">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-gray-900">
                  {isLogin ? 'Sign in to your account' : 'Create your account'}
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  {isLogin ? "Don't have an account?" : 'Already have an account?'}
                  <button
                    onClick={toggleAuthMode}
                    className="ml-1 font-medium text-blue-600 hover:text-blue-500 transition-colors"
                  >
                    {isLogin ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email address
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your email"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your password"
                  />
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm text-red-800">{error.message}</p>
                  </div>
                )}

                {message && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <p className="text-sm text-blue-800">{message}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {authLoading ? 'Processing...' : (isLogin ? 'Sign in' : 'Sign up')}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}