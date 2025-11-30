import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? false 
    : true, // Allow all origins in development for local network access
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'map-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Serve uploaded files
app.use('/uploads', express.static(uploadDir));

// Middleware to verify user authentication
const verifyAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Verify token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get current user
app.get('/api/user', verifyAuth, async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check session members
app.get('/api/debug/session-members', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: members, error } = await supabase
      .from('session_members')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    res.json({ 
      userId,
      memberCount: members?.length || 0,
      members: members || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new session
app.post('/api/sessions', verifyAuth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id;

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        name: name || 'New Session',
        description: description || '',
        dm_user_id: userId,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Add creator as session member with DM role
    const { error: memberError } = await supabase
      .from('session_members')
      .insert({
        session_id: session.id,
        user_id: userId,
        is_dm: true,
        joined_at: new Date().toISOString()
      });

    if (memberError) throw memberError;

    res.status(201).json({ session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all sessions for current user
app.get('/api/sessions', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    console.log('Fetching sessions for user:', userId);

    // First, get session members
    const { data: sessionMembers, error: membersError } = await supabase
      .from('session_members')
      .select('session_id, is_dm')
      .eq('user_id', userId);

    if (membersError) {
      console.error('Error fetching session members:', membersError);
      throw membersError;
    }

    console.log('Found session members:', sessionMembers?.length || 0);

    if (!sessionMembers || sessionMembers.length === 0) {
      return res.json({ sessions: [] });
    }

    // Get session IDs
    const sessionIds = sessionMembers.map(sm => sm.session_id);

    // Fetch sessions
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, name, description, dm_user_id, created_at, current_map_id')
      .in('id', sessionIds);

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      throw sessionsError;
    }

    // Get all session members for these sessions
    let allMembers = null;
    let allMembersError = null;
    
    try {
      const result = await supabase
        .from('session_members')
        .select('session_id, user_id, is_dm, nickname, character_class')
        .in('session_id', sessionIds);
      allMembers = result.data;
      allMembersError = result.error;
    } catch (err) {
      // If character_class column doesn't exist, fetch without it
      if (err.message && err.message.includes('character_class')) {
        console.log('character_class column not found, fetching without it...');
        const result = await supabase
          .from('session_members')
          .select('session_id, user_id, is_dm, nickname')
          .in('session_id', sessionIds);
        allMembers = result.data;
        allMembersError = result.error;
      } else {
        throw err;
      }
    }

    if (allMembersError) {
      console.error('Error fetching all members:', allMembersError);
    }

    // Group members by session
    const membersBySession = {};
    (allMembers || []).forEach(member => {
      if (!membersBySession[member.session_id]) {
        membersBySession[member.session_id] = [];
      }
      membersBySession[member.session_id].push({
        user_id: member.user_id,
        is_dm: member.is_dm,
        nickname: member.nickname,
        character_class: member.character_class || null,
        email: 'User' // Simplified - can fetch emails later if needed
      });
    });

    // Combine session data with membership info and members list
    const formattedSessions = (sessions || []).map(session => {
      const membership = sessionMembers.find(sm => sm.session_id === session.id);
      return {
        ...session,
        is_dm: membership?.is_dm || false,
        members: membersBySession[session.id] || []
      };
    });

    console.log('Returning sessions:', formattedSessions.length);
    res.json({ sessions: formattedSessions });
  } catch (error) {
    console.error('Sessions API error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch sessions' });
  }
});

// Get session details
app.get('/api/sessions/:sessionId', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if user is a member of this session
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Get session details
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    // Get session members
    const { data: members, error: membersError } = await supabase
      .from('session_members')
      .select('user_id, is_dm, nickname, character_class, joined_at')
      .eq('session_id', sessionId);

    if (membersError) {
      console.error('Error fetching session members:', membersError);
      // If character_class column doesn't exist, try without it
      if (membersError.message && membersError.message.includes('character_class')) {
        console.log('character_class column not found, fetching without it...');
        const { data: membersWithoutClass, error: membersError2 } = await supabase
          .from('session_members')
          .select('user_id, is_dm, nickname, joined_at')
          .eq('session_id', sessionId);
        
        if (membersError2) throw membersError2;
        
        // Map members and add null character_class
        const membersWithUsers = (membersWithoutClass || []).map((member) => {
          return {
            user_id: member.user_id,
            is_dm: member.is_dm,
            nickname: member.nickname,
            character_class: null,
            joined_at: member.joined_at,
            users: {
              id: member.user_id,
              email: 'User'
            }
          };
        });
        
        // Get current map if exists (filter by shared status for non-DM users)
        let currentMap = null;
        if (session.current_map_id) {
          let mapQuery = supabase
            .from('maps')
            .select('*')
            .eq('id', session.current_map_id);

          // If user is not DM, only return shared maps
          if (!membership.is_dm) {
            mapQuery = mapQuery.eq('shared', true);
          }

          const { data: map, error: mapError } = await mapQuery.single();

          // Only set currentMap if map exists and (is shared OR user is DM)
          if (!mapError && map) {
            currentMap = map;
          }
        }
        
        res.json({
          session: {
            ...session,
            is_dm: membership.is_dm,
            members: membersWithUsers || [],
            current_map: currentMap
          }
        });
        return;
      }
      throw membersError;
    }

    // Get user details for each member - simplified to avoid hanging
    // Just return basic member info without fetching emails (can be added later if needed)
    const membersWithUsers = (members || []).map((member) => {
      return {
        user_id: member.user_id,
        is_dm: member.is_dm,
        nickname: member.nickname,
        character_class: member.character_class,
        joined_at: member.joined_at,
        users: {
          id: member.user_id,
          email: 'User' // Simplified - can fetch emails later if needed
        }
      };
    });

    // Get current map if exists (filter by shared status for non-DM users)
    let currentMap = null;
    if (session.current_map_id) {
      let mapQuery = supabase
        .from('maps')
        .select('*')
        .eq('id', session.current_map_id);

      // If user is not DM, only return shared maps
      if (!membership.is_dm) {
        mapQuery = mapQuery.eq('shared', true);
      }

      const { data: map, error: mapError } = await mapQuery.single();

      // Only set currentMap if map exists and (is shared OR user is DM)
      if (!mapError && map) {
        currentMap = map;
      }
    }

    res.json({
      session: {
        ...session,
        is_dm: membership.is_dm,
        members: membersWithUsers || [],
        current_map: currentMap
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join a session
app.post('/api/sessions/:sessionId/join', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      return res.status(400).json({ error: 'You are already a member of this session' });
    }

    // Add as member
    const { data: member, error: memberError } = await supabase
      .from('session_members')
      .insert({
        session_id: sessionId,
        user_id: userId,
        is_dm: false,
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (memberError) throw memberError;

    res.status(201).json({ member });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a session (DM only)
app.delete('/api/sessions/:sessionId', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Check if session exists and user is DM
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, dm_user_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Verify user is the DM
    if (session.dm_user_id !== userId) {
      return res.status(403).json({ error: 'Only the session owner can delete the session' });
    }

    // Get all maps for this session to delete files
    const { data: maps, error: mapsError } = await supabase
      .from('maps')
      .select('file_path')
      .eq('session_id', sessionId);

    if (!mapsError && maps && maps.length > 0) {
      // Delete map files from filesystem
      maps.forEach(map => {
        try {
          // file_path is stored as /uploads/filename in database
          // Extract just the filename and join with uploadDir
          let filePath = map.file_path;
          // Remove /uploads/ prefix if present
          if (filePath.startsWith('/uploads/')) {
            const filename = filePath.replace('/uploads/', '');
            filePath = path.join(uploadDir, filename);
          } else if (filePath.startsWith('uploads/')) {
            const filename = filePath.replace('uploads/', '');
            filePath = path.join(uploadDir, filename);
          } else {
            // If it's just a filename, join directly
            filePath = path.join(uploadDir, path.basename(filePath));
          }
          
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Deleted map file:', filePath);
          } else {
            console.log('Map file not found (may have been deleted already):', filePath);
          }
        } catch (fileError) {
          console.error('Error deleting map file:', map.file_path, fileError);
        }
      });
    }

    // Delete session (cascade will handle related records: members, invitations, maps, pawns, quotes)
    const { error: deleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    if (deleteError) throw deleteError;

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Delete session error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete session' });
  }
});

// Transfer DM role
app.post('/api/sessions/:sessionId/transfer-dm', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { newDmUserId } = req.body;
    const userId = req.user.id;

    if (!newDmUserId) {
      return res.status(400).json({ error: 'newDmUserId is required' });
    }

    // Verify current user is DM
    const { data: currentMembership, error: currentError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (currentError || !currentMembership || !currentMembership.is_dm) {
      return res.status(403).json({ error: 'Only the current DM can transfer the role' });
    }

    // Verify new DM is a member
    const { data: newMember, error: newMemberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', newDmUserId)
      .single();

    if (newMemberError || !newMember) {
      return res.status(404).json({ error: 'New DM user is not a member of this session' });
    }

    // Update session DM
    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ dm_user_id: newDmUserId })
      .eq('id', sessionId);

    if (sessionError) throw sessionError;

    // Update session members
    const { error: oldDmError } = await supabase
      .from('session_members')
      .update({ is_dm: false })
      .eq('session_id', sessionId)
      .eq('user_id', userId);

    if (oldDmError) throw oldDmError;

    const { error: newDmError } = await supabase
      .from('session_members')
      .update({ is_dm: true })
      .eq('session_id', sessionId)
      .eq('user_id', newDmUserId);

    if (newDmError) throw newDmError;

    res.json({ message: 'DM role transferred successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user nickname in session
app.put('/api/sessions/:sessionId/nickname', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { nickname } = req.body;
    const userId = req.user.id;

    // Verify user is a member of this session
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Update nickname
    const { data: updatedMember, error: updateError } = await supabase
      .from('session_members')
      .update({ nickname: nickname || null })
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .select('user_id, is_dm, nickname')
      .single();
    
    // Add character_class if column exists (for backward compatibility)
    if (updatedMember && updatedMember.character_class === undefined) {
      updatedMember.character_class = null;
    }

    if (updateError) throw updateError;

    res.json({ member: updatedMember, message: 'Nickname updated successfully' });
  } catch (error) {
    console.error('Update nickname error:', error);
    res.status(500).json({ error: error.message || 'Failed to update nickname' });
  }
});

// Update user character class in session
app.put('/api/sessions/:sessionId/class', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { characterClass, targetUserId } = req.body;
    const userId = req.user.id;

    // Determine which user's class to update
    const updateUserId = targetUserId || userId;

    // Verify user is a member of this session
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // If updating someone else's class, verify user is DM
    if (updateUserId !== userId && !membership.is_dm) {
      return res.status(403).json({ error: 'Only the DM can update other players\' classes' });
    }

    // Verify target user is a member
    const { data: targetMember, error: targetError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', updateUserId)
      .single();

    if (targetError || !targetMember) {
      return res.status(404).json({ error: 'Target user is not a member of this session' });
    }

    // Update character class
    // First check if column exists by trying to update
    let updatedMember;
    let updateError;
    
    try {
      const result = await supabase
        .from('session_members')
        .update({ character_class: characterClass || null })
        .eq('session_id', sessionId)
        .eq('user_id', updateUserId)
        .select('user_id, is_dm, nickname, character_class')
        .single();
      updatedMember = result.data;
      updateError = result.error;
    } catch (err) {
      if (err.message && err.message.includes('character_class')) {
        return res.status(400).json({ 
          error: 'Character class feature not available. Please run the database migration to add the character_class column.' 
        });
      }
      throw err;
    }

    if (updateError) {
      if (updateError.message && updateError.message.includes('character_class')) {
        return res.status(400).json({ 
          error: 'Character class feature not available. Please run the database migration to add the character_class column.' 
        });
      }
      throw updateError;
    }

    res.json({ member: updatedMember, message: 'Character class updated successfully' });
  } catch (error) {
    console.error('Update class error:', error);
    res.status(500).json({ error: error.message || 'Failed to update character class' });
  }
});

// Invite user to session (DM only)
app.post('/api/sessions/:sessionId/invite', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { email } = req.body;
    const userId = req.user.id;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required' });
    }

    // Verify user is DM
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership || !membership.is_dm) {
      return res.status(403).json({ error: 'Only the DM can invite users' });
    }

    // Check if session exists
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, name')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Check if user with this email exists
    let invitedUserId = null;
    try {
      // Try to find user by email using Supabase REST API
      const userResponse = await fetch(
        `${process.env.SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        {
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      );
      
      if (userResponse.ok) {
        const users = await userResponse.json();
        if (users.users && users.users.length > 0) {
          invitedUserId = users.users[0].id;
        }
      }
    } catch (err) {
      console.error('Error checking user email:', err);
      // Continue without user ID - invitation will work for non-registered users too
    }

    // Check if already a member
    if (invitedUserId) {
      const { data: existingMember } = await supabase
        .from('session_members')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', invitedUserId)
        .single();

      if (existingMember) {
        return res.status(400).json({ error: 'This user is already a member of the session' });
      }
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('session_id', sessionId)
      .eq('invited_email', email.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return res.status(400).json({ error: 'An invitation has already been sent to this email' });
    }

    // Create invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .insert({
        session_id: sessionId,
        invited_by: userId,
        invited_email: email.toLowerCase(),
        invited_user_id: invitedUserId,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (inviteError) throw inviteError;

    res.status(201).json({ invitation });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: error.message || 'Failed to create invitation' });
  }
});

// Get pending invitations for current user
app.get('/api/invitations', verifyAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user email
    const userEmail = req.user.email?.toLowerCase();

    if (!userEmail) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Get invitations for this user's email or user_id
    const { data: invitations, error } = await supabase
      .from('invitations')
      .select(`
        id,
        session_id,
        invited_by,
        invited_email,
        status,
        created_at,
        sessions (
          id,
          name,
          description
        )
      `)
      .or(`invited_email.eq.${userEmail},invited_user_id.eq.${userId}`)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get inviter details
    const invitationsWithInviter = await Promise.all(
      (invitations || []).map(async (invitation) => {
        try {
          const inviterResponse = await fetch(
            `${process.env.SUPABASE_URL}/auth/v1/admin/users/${invitation.invited_by}`,
            {
              headers: {
                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
              }
            }
          );
          
          let inviterEmail = 'Unknown';
          if (inviterResponse.ok) {
            const inviter = await inviterResponse.json();
            inviterEmail = inviter.email || 'Unknown';
          }
          
          return {
            ...invitation,
            inviter_email: inviterEmail
          };
        } catch (err) {
          console.error('Error fetching inviter:', err);
          return {
            ...invitation,
            inviter_email: 'Unknown'
          };
        }
      })
    );

    res.json({ invitations: invitationsWithInviter });
  } catch (error) {
    console.error('Get invitations error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch invitations' });
  }
});

// Accept invitation
app.post('/api/invitations/:invitationId/accept', verifyAuth, async (req, res) => {
  try {
    const { invitationId } = req.params;
    const { nickname } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email?.toLowerCase();

    if (!userEmail) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Get invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (inviteError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Verify invitation is for this user
    if (invitation.invited_email !== userEmail && invitation.invited_user_id !== userId) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }

    // Verify invitation is pending
    if (invitation.status !== 'pending') {
      return res.status(400).json({ error: 'This invitation has already been processed' });
    }

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', invitation.session_id)
      .eq('user_id', userId)
      .single();

    if (existingMember) {
      // Update invitation status
      await supabase
        .from('invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitationId);
      
      return res.status(400).json({ error: 'You are already a member of this session' });
    }

    // Add as member with nickname
    const { data: member, error: memberError } = await supabase
      .from('session_members')
      .insert({
        session_id: invitation.session_id,
        user_id: userId,
        is_dm: false,
        nickname: nickname || null,
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (memberError) throw memberError;

    // Auto-create a pawn for the new player
    try {
      // Get session to find current map dimensions (if map exists)
      const { data: sessionData } = await supabase
        .from('sessions')
        .select('current_map_id, maps(id)')
        .eq('id', invitation.session_id)
        .single();

      if (sessionData?.current_map_id) {
        // Create a pawn at center of map (will be adjusted based on actual map size)
        // Default to center position (500, 500) - will be adjusted when map loads
        await supabase
          .from('pawns')
          .insert({
            session_id: invitation.session_id,
            created_by: userId, // Self-created
            owned_by: userId,
            name: nickname || 'Player',
            color: `#${Math.floor(Math.random()*16777215).toString(16)}`, // Random color
            x_position: 500, // Default center, will be adjusted
            y_position: 500,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      }
    } catch (pawnError) {
      console.error('Error auto-creating pawn:', pawnError);
      // Don't fail the invitation acceptance if pawn creation fails
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('invitations')
      .update({ 
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        invited_user_id: userId // Link the user ID if not already set
      })
      .eq('id', invitationId);

    if (updateError) {
      console.error('Error updating invitation:', updateError);
      // Don't fail the request, membership was created
    }

    res.json({ member, message: 'Invitation accepted successfully' });
  } catch (error) {
    console.error('Accept invitation error:', error);
    res.status(500).json({ error: error.message || 'Failed to accept invitation' });
  }
});

// Decline invitation
app.post('/api/invitations/:invitationId/decline', verifyAuth, async (req, res) => {
  try {
    const { invitationId } = req.params;
    const userId = req.user.id;
    const userEmail = req.user.email?.toLowerCase();

    if (!userEmail) {
      return res.status(400).json({ error: 'User email not found' });
    }

    // Get invitation
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .single();

    if (inviteError || !invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Verify invitation is for this user
    if (invitation.invited_email !== userEmail && invitation.invited_user_id !== userId) {
      return res.status(403).json({ error: 'This invitation is not for you' });
    }

    // Update invitation status
    const { error: updateError } = await supabase
      .from('invitations')
      .update({ status: 'declined' })
      .eq('id', invitationId);

    if (updateError) throw updateError;

    res.json({ message: 'Invitation declined' });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to decline invitation' });
  }
});

// Upload map (DM only)
app.post('/api/sessions/:sessionId/maps', verifyAuth, upload.single('map'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify user is DM
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership || !membership.is_dm) {
      // Delete uploaded file if not authorized
      fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Only the DM can upload maps' });
    }

    // Create map record (default to not shared - DM can share later)
    const { data: map, error: mapError } = await supabase
      .from('maps')
      .insert({
        session_id: sessionId,
        uploaded_by: userId,
        filename: req.file.filename,
        original_filename: req.file.originalname,
        file_path: `/uploads/${req.file.filename}`,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        shared: false, // Default to not shared - DM must explicitly share
        fog_of_war: null, // No fog of war initially
        uploaded_at: new Date().toISOString()
      })
      .select()
      .single();

    if (mapError) {
      fs.unlinkSync(req.file.path);
      throw mapError;
    }

    // Update session with current map
    const { error: sessionError } = await supabase
      .from('sessions')
      .update({ current_map_id: map.id })
      .eq('id', sessionId);

    if (sessionError) {
      // Rollback map creation
      await supabase.from('maps').delete().eq('id', map.id);
      fs.unlinkSync(req.file.path);
      throw sessionError;
    }

    res.status(201).json({ map });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Share/unshare map (DM only)
app.put('/api/maps/:mapId/share', verifyAuth, async (req, res) => {
  try {
    const { mapId } = req.params;
    const { shared } = req.body;
    const userId = req.user.id;

    // Get map (without join - just get the map directly)
    const { data: map, error: mapError } = await supabase
      .from('maps')
      .select('*')
      .eq('id', mapId)
      .single();

    if (mapError || !map) {
      console.error('Map not found error:', mapError);
      return res.status(404).json({ error: 'Map not found' });
    }

    // Verify user is DM
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', map.session_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership || !membership.is_dm) {
      return res.status(403).json({ error: 'Only the DM can share/unshare maps' });
    }

    // Update map shared status
    const { data: updatedMap, error: updateError } = await supabase
      .from('maps')
      .update({ shared: shared !== false })
      .eq('id', mapId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ map: updatedMap });
  } catch (error) {
    console.error('Share map error:', error);
    res.status(500).json({ error: error.message || 'Failed to share map' });
  }
});

// Update fog of war (DM only)
app.put('/api/maps/:mapId/fog-of-war', verifyAuth, async (req, res) => {
  try {
    const { mapId } = req.params;
    const { fog_of_war } = req.body;
    const userId = req.user.id;

    // Get map
    const { data: map, error: mapError } = await supabase
      .from('maps')
      .select('*')
      .eq('id', mapId)
      .single();

    if (mapError || !map) {
      console.error('Map not found error:', mapError);
      return res.status(404).json({ error: 'Map not found' });
    }

    // Verify user is DM
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', map.session_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership || !membership.is_dm) {
      return res.status(403).json({ error: 'Only the DM can update fog of war' });
    }

    // Update fog of war (store as JSON string)
    const fogOfWarJson = fog_of_war ? JSON.stringify(fog_of_war) : null;
    
    const { data: updatedMap, error: updateError } = await supabase
      .from('maps')
      .update({ fog_of_war: fogOfWarJson })
      .eq('id', mapId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ map: updatedMap });
  } catch (error) {
    console.error('Update fog of war error:', error);
    res.status(500).json({ error: error.message || 'Failed to update fog of war' });
  }
});

// Get current map for session
app.get('/api/sessions/:sessionId/map', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verify user is a member and check if DM
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id, is_dm')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    const isDm = membership.is_dm;

    // Get session to find current map
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('current_map_id')
      .eq('id', sessionId)
      .single();

    if (sessionError) throw sessionError;

    if (!session.current_map_id) {
      return res.json({ map: null });
    }

    // Get map details
    let mapQuery = supabase
      .from('maps')
      .select('*')
      .eq('id', session.current_map_id);

    // If user is not DM, only show shared maps
    if (!isDm) {
      mapQuery = mapQuery.eq('shared', true);
    }

    const { data: map, error: mapError } = await mapQuery.single();

    if (mapError) {
      // If map not found and user is not DM, it might be because map is not shared
      if (!isDm) {
        return res.json({ map: null });
      }
      throw mapError;
    }

    res.json({ map: map || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all pawns for a session
app.get('/api/sessions/:sessionId/pawns', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Check if user is DM
    const { data: dmCheck, error: dmCheckError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    const isDm = dmCheck?.is_dm || false;

    // Get all active pawns for this session (status is null)
    // If user is not DM, filter out invisible pawns
    let pawnsQuery = supabase
      .from('pawns')
      .select('*')
      .eq('session_id', sessionId)
      .is('status', null)
      .order('created_at', { ascending: true });

    // Filter invisible pawns for non-DM users
    if (!isDm) {
      pawnsQuery = pawnsQuery.eq('visible', true);
    }

    const { data: pawns, error: pawnsError } = await pawnsQuery;

    if (pawnsError) throw pawnsError;

    res.json({ pawns: pawns || [] });
  } catch (error) {
    console.error('Get pawns error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pawns' });
  }
});

// Create a new pawn (DM only)
app.post('/api/sessions/:sessionId/pawns', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { name, color, status_color, x_position, y_position, owned_by, hp, max_hp, visible } = req.body;
    const userId = req.user.id;

    // Verify user is DM
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership || !membership.is_dm) {
      return res.status(403).json({ error: 'Only the DM can create pawns' });
    }

    // Create pawn
    const { data: pawn, error: pawnError } = await supabase
      .from('pawns')
      .insert({
        session_id: sessionId,
        created_by: userId,
        owned_by: owned_by || null,
        name: name || 'New Pawn',
        color: color || '#667eea',
        status_color: status_color || null,
        x_position: x_position || 0,
        y_position: y_position || 0,
        hp: hp !== undefined && hp !== null ? hp : null,
        max_hp: max_hp !== undefined && max_hp !== null ? max_hp : null,
        visible: visible !== undefined ? visible : true, // Default to visible
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (pawnError) throw pawnError;

    res.status(201).json({ pawn });
  } catch (error) {
    console.error('Create pawn error:', error);
    res.status(500).json({ error: error.message || 'Failed to create pawn' });
  }
});

// Update pawn position or HP
app.put('/api/pawns/:pawnId', verifyAuth, async (req, res) => {
  try {
    const { pawnId } = req.params;
    const { x_position, y_position, hp, max_hp, visible, name, color, status_color, owned_by } = req.body;
    const userId = req.user.id;

    // Get pawn
    const { data: pawn, error: pawnError } = await supabase
      .from('pawns')
      .select('*, sessions!inner(id)')
      .eq('id', pawnId)
      .single();

    if (pawnError || !pawn) {
      return res.status(404).json({ error: 'Pawn not found' });
    }

    // Verify user can move this pawn (owner or DM)
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', pawn.session_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    const canMove = membership.is_dm || pawn.owned_by === userId;

    if (!canMove) {
      return res.status(403).json({ error: 'You can only move your own pawns' });
    }

    // Build update object
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    if (x_position !== undefined) updateData.x_position = parseFloat(x_position);
    if (y_position !== undefined) updateData.y_position = parseFloat(y_position);
    if (hp !== undefined) updateData.hp = hp !== null ? hp : null;
    if (max_hp !== undefined) updateData.max_hp = max_hp !== null ? max_hp : null;
    if (visible !== undefined) updateData.visible = visible;
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;
    if (status_color !== undefined) updateData.status_color = status_color || null;
    if (owned_by !== undefined) updateData.owned_by = owned_by || null;
    
    // If updating HP, visibility, name, color, or owned_by, verify user is DM
    if ((hp !== undefined || max_hp !== undefined || visible !== undefined || name !== undefined || color !== undefined || owned_by !== undefined) && !membership.is_dm) {
      return res.status(403).json({ error: 'Only the DM can update pawn properties' });
    }
    
    // Players can update their own pawn's status_color
    if (status_color !== undefined && !membership.is_dm) {
      if (pawn.owned_by !== userId) {
        return res.status(403).json({ error: 'You can only update your own pawn\'s status color' });
      }
    }

    // Update pawn
    const { data: updatedPawn, error: updateError } = await supabase
      .from('pawns')
      .update(updateData)
      .eq('id', pawnId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ pawn: updatedPawn });
  } catch (error) {
    console.error('Update pawn error:', error);
    res.status(500).json({ error: error.message || 'Failed to update pawn' });
  }
});

// Set enemy status (DM only) - replaces delete, marks enemy as killed/fled/freed
app.put('/api/pawns/:pawnId/status', verifyAuth, async (req, res) => {
  try {
    const { pawnId } = req.params;
    const { status } = req.body; // 'killed', 'fled', 'freed', or null to reactivate
    const userId = req.user.id;

    if (status && !['killed', 'fled', 'freed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be killed, fled, or freed' });
    }

    // Get pawn
    const { data: pawn, error: pawnError } = await supabase
      .from('pawns')
      .select('session_id')
      .eq('id', pawnId)
      .single();

    if (pawnError || !pawn) {
      return res.status(404).json({ error: 'Pawn not found' });
    }

    // Verify user is DM
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', pawn.session_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership || !membership.is_dm) {
      return res.status(403).json({ error: 'Only the DM can set enemy status' });
    }

    // Update pawn status
    const updateData = {
      status: status || null,
      status_set_at: status ? new Date().toISOString() : null,
      status_set_by: status ? userId : null,
      updated_at: new Date().toISOString()
    };

    const { data: updatedPawn, error: updateError } = await supabase
      .from('pawns')
      .update(updateData)
      .eq('id', pawnId)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({ pawn: updatedPawn, message: `Enemy marked as ${status || 'active'}` });
  } catch (error) {
    console.error('Set enemy status error:', error);
    res.status(500).json({ error: error.message || 'Failed to set enemy status' });
  }
});

// Delete a pawn (DM only) - actual deletion
app.delete('/api/pawns/:pawnId', verifyAuth, async (req, res) => {
  try {
    const { pawnId } = req.params;
    const userId = req.user.id;

    // Get pawn
    const { data: pawn, error: pawnError } = await supabase
      .from('pawns')
      .select('session_id')
      .eq('id', pawnId)
      .single();

    if (pawnError || !pawn) {
      return res.status(404).json({ error: 'Pawn not found' });
    }

    // Verify user is DM
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('is_dm')
      .eq('session_id', pawn.session_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership || !membership.is_dm) {
      return res.status(403).json({ error: 'Only the DM can delete pawns' });
    }

    // Delete pawn
    const { error: deleteError } = await supabase
      .from('pawns')
      .delete()
      .eq('id', pawnId);

    if (deleteError) throw deleteError;

    res.json({ message: 'Pawn deleted successfully' });
  } catch (error) {
    console.error('Delete pawn error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete pawn' });
  }
});

// Get enemy statistics for a session
app.get('/api/sessions/:sessionId/enemies', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Get all pawns with status (enemies)
    const { data: enemies, error: enemiesError } = await supabase
      .from('pawns')
      .select('id, name, status, status_set_at, status_set_by')
      .eq('session_id', sessionId)
      .not('status', 'is', null)
      .order('status_set_at', { ascending: false });

    if (enemiesError) throw enemiesError;

    // Calculate statistics
    const stats = {
      killed: enemies.filter(e => e.status === 'killed').length,
      fled: enemies.filter(e => e.status === 'fled').length,
      freed: enemies.filter(e => e.status === 'freed').length,
      total: enemies.length
    };

    res.json({ enemies: enemies || [], stats });
  } catch (error) {
    console.error('Get enemies error:', error);
    res.status(500).json({ error: error.message || 'Failed to get enemy statistics' });
  }
});

// Get all quotes for a session
app.get('/api/sessions/:sessionId/quotes', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Get all quotes for this session
    const { data: quotes, error: quotesError } = await supabase
      .from('quotes')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (quotesError) throw quotesError;

    res.json({ quotes: quotes || [] });
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch quotes' });
  }
});

// Create a new quote
app.post('/api/sessions/:sessionId/quotes', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { quote_text, author_name } = req.body;
    const userId = req.user.id;

    if (!quote_text || !quote_text.trim()) {
      return res.status(400).json({ error: 'Quote text is required' });
    }

    if (!author_name || !author_name.trim()) {
      return res.status(400).json({ error: 'Author name is required' });
    }

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Create quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .insert({
        session_id: sessionId,
        created_by: userId,
        quote_text: quote_text.trim(),
        author_name: author_name.trim(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (quoteError) throw quoteError;

    res.status(201).json({ quote });
  } catch (error) {
    console.error('Create quote error:', error);
    res.status(500).json({ error: error.message || 'Failed to create quote' });
  }
});

// Delete a quote (any session member can delete)
app.delete('/api/quotes/:quoteId', verifyAuth, async (req, res) => {
  try {
    const { quoteId } = req.params;
    const userId = req.user.id;

    // Get quote
    const { data: quote, error: quoteError } = await supabase
      .from('quotes')
      .select('session_id')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quote) {
      return res.status(404).json({ error: 'Quote not found' });
    }

    // Verify user is a member of the session
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', quote.session_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Delete quote
    const { error: deleteError } = await supabase
      .from('quotes')
      .delete()
      .eq('id', quoteId);

    if (deleteError) throw deleteError;

    res.json({ message: 'Quote deleted successfully' });
  } catch (error) {
    console.error('Delete quote error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete quote' });
  }
});

// Get personal notes for a user in a session
app.get('/api/sessions/:sessionId/personal-notes', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Get personal notes for this user
    const { data: notes, error: notesError } = await supabase
      .from('personal_notes')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (notesError) throw notesError;

    res.json({ notes: notes || [] });
  } catch (error) {
    console.error('Get personal notes error:', error);
    res.status(500).json({ error: error.message || 'Failed to get personal notes' });
  }
});

// Create a personal note
app.post('/api/sessions/:sessionId/personal-notes', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, note_text } = req.body;
    const userId = req.user.id;

    if (!note_text || !note_text.trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Create note
    const { data: note, error: noteError } = await supabase
      .from('personal_notes')
      .insert({
        session_id: sessionId,
        user_id: userId,
        title: title?.trim() || null,
        note_text: note_text.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (noteError) throw noteError;

    res.status(201).json({ note });
  } catch (error) {
    console.error('Create personal note error:', error);
    res.status(500).json({ error: error.message || 'Failed to create personal note' });
  }
});

// Delete a personal note
app.delete('/api/personal-notes/:noteId', verifyAuth, async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;

    // Verify note belongs to user
    const { data: note, error: noteError } = await supabase
      .from('personal_notes')
      .select('id, user_id')
      .eq('id', noteId)
      .single();

    if (noteError || !note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (note.user_id !== userId) {
      return res.status(403).json({ error: 'You can only delete your own notes' });
    }

    // Delete note
    const { error: deleteError } = await supabase
      .from('personal_notes')
      .delete()
      .eq('id', noteId);

    if (deleteError) throw deleteError;

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete personal note error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete note' });
  }
});

// Get shared notes for a session
app.get('/api/sessions/:sessionId/shared-notes', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Get shared notes for this session
    const { data: notes, error: notesError } = await supabase
      .from('shared_notes')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (notesError) throw notesError;

    res.json({ notes: notes || [] });
  } catch (error) {
    console.error('Get shared notes error:', error);
    res.status(500).json({ error: error.message || 'Failed to get shared notes' });
  }
});

// Create a shared note
app.post('/api/sessions/:sessionId/shared-notes', verifyAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { title, note_text } = req.body;
    const userId = req.user.id;

    if (!note_text || !note_text.trim()) {
      return res.status(400).json({ error: 'Note text is required' });
    }

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Create note
    const { data: note, error: noteError } = await supabase
      .from('shared_notes')
      .insert({
        session_id: sessionId,
        created_by: userId,
        title: title?.trim() || null,
        note_text: note_text.trim(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (noteError) throw noteError;

    res.status(201).json({ note });
  } catch (error) {
    console.error('Create shared note error:', error);
    res.status(500).json({ error: error.message || 'Failed to create shared note' });
  }
});

// Delete a shared note
app.delete('/api/shared-notes/:noteId', verifyAuth, async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;

    // Get note and verify user is a member of the session
    const { data: note, error: noteError } = await supabase
      .from('shared_notes')
      .select('session_id')
      .eq('id', noteId)
      .single();

    if (noteError || !note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Verify user is a member
    const { data: membership, error: memberError } = await supabase
      .from('session_members')
      .select('id')
      .eq('session_id', note.session_id)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return res.status(403).json({ error: 'You are not a member of this session' });
    }

    // Delete note
    const { error: deleteError } = await supabase
      .from('shared_notes')
      .delete()
      .eq('id', noteId);

    if (deleteError) throw deleteError;

    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete shared note error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete note' });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📡 Accessible on local network at http://[YOUR_IP]:${PORT}`);
  console.log(`\nTo find your local IP address:`);
  console.log(`  macOS/Linux: ifconfig | grep "inet "`);
  console.log(`  Windows: ipconfig`);
});

