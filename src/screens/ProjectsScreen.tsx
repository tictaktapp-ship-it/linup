import type { Project } from '../lib/supabaseService';
import { listProjects } from '../lib/supabaseService';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
// invoke not needed for Supabase reads