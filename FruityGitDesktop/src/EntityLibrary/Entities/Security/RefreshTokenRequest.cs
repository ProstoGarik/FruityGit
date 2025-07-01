using Microsoft.AspNetCore.Mvc;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace EntityLibrary.Entities.Security
{
    public class RefreshTokenRequest

    {
        public required string Token { get; set; }
    }
}
