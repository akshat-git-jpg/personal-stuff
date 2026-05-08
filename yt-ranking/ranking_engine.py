import googleapiclient.discovery
import googleapiclient.errors
import urllib.parse as urlparse

class YoutubeAPIRankChecker:
    def __init__(self, api_key):
        self.youtube = googleapiclient.discovery.build(
            "youtube", "v3", developerKey=api_key
        )

    def extract_video_id(self, url):
        """Extracts video ID from a YouTube URL."""
        parsed_url = urlparse.urlparse(url)
        if parsed_url.hostname == 'youtu.be':
            return parsed_url.path[1:]
        if parsed_url.hostname in ('www.youtube.com', 'youtube.com'):
            if parsed_url.path == '/watch':
                p = urlparse.parse_qs(parsed_url.query)
                return p.get('v', [None])[0]
            if parsed_url.path[:7] == '/embed/':
                return parsed_url.path.split('/')[2]
            if parsed_url.path[:3] == '/v/':
                return parsed_url.path.split('/')[2]
        return url  # Assume it's already a video ID if extraction fails

    def get_ranking(self, keyword, video_url, max_results=50):
        """
        Finds the ranking of a video for a given keyword.
        Returns the rank (1-indexed) or -1 if not found in max_results.
        """
        target_video_id = self.extract_video_id(video_url)
        
        try:
            request = self.youtube.search().list(
                q=keyword,
                part="id",
                type="video",
                maxResults=max_results
            )
            response = request.execute()

            for index, item in enumerate(response.get("items", [])):
                if item["id"]["videoId"] == target_video_id:
                    return index + 1  # 1-indexed rank
            
            return -1  # Not found in the top results
        except googleapiclient.errors.HttpError as e:
            print(f"An error occurred: {e}")
            return -2  # Error state
