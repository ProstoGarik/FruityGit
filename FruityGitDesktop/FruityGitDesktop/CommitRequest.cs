using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace FruityGitDesktop
{
    public class CommitRequest
    {
        public string Summary { get; set; }
        public string Description { get; set; }
        public string UserName { get; set; }
        public string UserEmail { get; set; }
        public IFormFile File { get; set; }
    }
}
