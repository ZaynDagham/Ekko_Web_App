import axios from 'axios';

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'; 

const posterCache: Record<string, string> = {};

export async function getPoster(imdbId: string): Promise<string | null> {
  if (posterCache[imdbId]) return posterCache[imdbId];

  try {
    const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const response = await axios.get(findUrl);
    
    const data = response.data;
    const results = (data.movie_results?.length > 0) ? data.movie_results : data.tv_results; 

    if (results && results.length > 0 && results[0].poster_path) {
      const posterUrl = `${IMAGE_BASE_URL}${results[0].poster_path}`;
      posterCache[imdbId] = posterUrl;
      return posterUrl;
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch poster for ${imdbId}`, error);
    return null;
  }
}

export async function getBackdrop(imdbId: string): Promise<string | null> {
  try {
    const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const response = await axios.get(findUrl);
    const data = response.data;
    const results = (data.movie_results?.length > 0) ? data.movie_results : data.tv_results;

    if (results && results.length > 0 && results[0].backdrop_path) {
      return `https://image.tmdb.org/t/p/original${results[0].backdrop_path}`;
    }
    return null;
  } catch (error) {
    return null;
  }
}

export async function getTMDBDetails(imdbId: string) {
  try {
    // Find the TMDB ID
    const findUrl = `${TMDB_BASE_URL}/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;
    const findRes = await axios.get(findUrl);
    const data = findRes.data;

    let mediaType = 'movie';
    let result = data.movie_results?.[0];

    if (!result && data.tv_results?.length > 0) {
        mediaType = 'tv';
        result = data.tv_results[0];
    }

    if (!result) return null;

    // Fetch Full Details + Credits
    const detailsUrl = `${TMDB_BASE_URL}/${mediaType}/${result.id}?api_key=${TMDB_API_KEY}&append_to_response=credits`;
    const detailsRes = await axios.get(detailsUrl);
    const details = detailsRes.data;

    // Extract Directors / Creators (WITH PHOTOS NOW)
    let directors: { name: string; pic: string | null }[] = [];
    
    if (mediaType === 'movie') {
        directors = details.credits?.crew
            ?.filter((p: any) => p.job === 'Director')
            ?.slice(0, 2)
            ?.map((p: any) => ({
                name: p.name,
                pic: p.profile_path ? `${IMAGE_BASE_URL}${p.profile_path}` : null
            })) || [];
    } else {
        // For TV, 'created_by' holds the creators
        if (details.created_by?.length > 0) {
            directors = details.created_by.map((p: any) => ({
                name: p.name,
                pic: p.profile_path ? `${IMAGE_BASE_URL}${p.profile_path}` : null
            }));
        }
    }

    // Extract Top Cast
    const cast = details.credits?.cast
        ?.slice(0, 10) // Top 10
        ?.map((p: any) => ({
            name: p.name,
            character: p.character,
            pic: p.profile_path ? `${IMAGE_BASE_URL}${p.profile_path}` : null
        })) || [];

    return {
        type: mediaType === 'movie' ? 'Movie' : 'TV Series',
        plot: details.overview,
        cast,
        directors
    };

  } catch (error) {
    console.error("TMDB Details Error", error);
    return null;
  }
}


// Cache for person images to avoid repeated lookups
const personCache: Record<string, { image: string | null; bio: string; id: number }> = {};

export async function getPersonDetails(name: string) {
  if (personCache[name]) return personCache[name];

  try {
    // Search for the Person ID
    const searchUrl = `${TMDB_BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(name)}`;
    const searchRes = await axios.get(searchUrl);
    const results = searchRes.data.results;

    if (results && results.length > 0) {
      const person = results[0];
      const personId = person.id;
      const imageUrl = person.profile_path ? `${IMAGE_BASE_URL}${person.profile_path}` : null;

      // Get Full Details (Biography) using ID
      const detailsUrl = `${TMDB_BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}`;
      const detailsRes = await axios.get(detailsUrl);
      
      const data = {
          image: imageUrl,
          bio: detailsRes.data.biography || "Biography not available.",
          id: personId
      };

      personCache[name] = data;
      return data;
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch details for ${name}`, error);
    return null;
  }
}